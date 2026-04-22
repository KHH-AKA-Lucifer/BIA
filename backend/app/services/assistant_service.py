from __future__ import annotations

import re
from typing import Any

import pandas as pd

from app.core.config import settings
from app.services import databoard_service
from app.services.llm_service import generate_context_bound_answer
from app.services.predictive_service import (
    forecast_entity,
    get_location_segments,
    get_model_registry,
    predict_machine_risk,
)


def _normalize(text: str) -> str:
    lowered = text.casefold()
    lowered = re.sub(r"([a-z])(\d)", r"\1 \2", lowered)
    lowered = re.sub(r"(\d)([a-z])", r"\1 \2", lowered)
    replacements = {
        "bestselling": "best selling",
        "topselling": "top selling",
        "mostsold": "most sold",
        "highestselling": "highest selling",
        "sellingproduct": "selling product",
        "topproduct": "top product",
        "restockpriority": "restock priority",
        "bestperforming": "best performing",
        "mostprofitable": "most profitable",
        "perfoming": "performing",
        "assitance": "assistance",
        "assistence": "assistance",
        "prodcut": "product",
        "locaton": "location",
        "categry": "category",
        "machne": "machine",
        "subcategorys": "subcategories",
    }
    for source, target in replacements.items():
        lowered = lowered.replace(source, target)
    return " ".join(lowered.split())


def _extract_best_match(message: str, candidates: list[str]) -> str | None:
    normalized_message = _normalize(message)
    for candidate in sorted(candidates, key=len, reverse=True):
        if _normalize(candidate) in normalized_message:
            return candidate
    return None


def _extract_matches(message: str, candidates: list[str], limit: int = 3) -> list[str]:
    normalized_message = _normalize(message)
    matches: list[str] = []
    for candidate in sorted(candidates, key=len, reverse=True):
        if _normalize(candidate) in normalized_message:
            matches.append(candidate)
        if len(matches) >= limit:
            break
    return matches


def _request_topics(message: str) -> set[str]:
    lowered = _normalize(message)
    topic_map = {
        "location": ("location", "locations", "site", "sites", "place", "places", "map"),
        "category": ("category", "categories", "subcategory", "subcategories", "assortment", "mix"),
        "product": ("product", "products", "item", "items", "sku", "skus", "brand", "selling", "sold"),
        "machine": ("machine", "machines", "device", "devices", "restock", "route", "service"),
        "trend": ("trend", "time", "daily", "weekly", "monthly", "hour", "weekday", "peak"),
        "payment": ("payment", "cashless", "cash", "card"),
        "comparison": ("compare", "versus", "vs", "difference"),
        "performance": ("top", "best", "highest", "lowest", "underperform", "perform", "selling", "sold"),
        "prediction": ("predict", "forecast", "next", "future"),
        "model": ("model", "classifier", "clustering", "segment"),
    }
    topics = {
        topic
        for topic, keywords in topic_map.items()
        if any(keyword in lowered for keyword in keywords)
    }
    if not topics:
        topics.add("performance")
    return topics


def _infer_period(message: str, default_period: str) -> str:
    lowered = _normalize(message)
    if any(token in lowered for token in ("last 7 days", "past 7 days", "last week", "this week", "weekly")):
        return "week"
    if any(token in lowered for token in ("last 30 days", "past 30 days", "last month", "this month", "monthly")):
        return "month"
    if any(token in lowered for token in ("last 90 days", "past 90 days", "last quarter", "this quarter", "quarterly")):
        return "quarter"
    if any(token in lowered for token in ("last 365 days", "past 365 days", "last year", "this year", "yearly", "annual")):
        return "year"
    return default_period


def _is_forecast_request(message: str) -> bool:
    lowered = _normalize(message)
    forecast_tokens = (
        "forecast",
        "predict",
        "prediction",
        "expected",
        "estimate",
        "projected",
        "tomorrow",
        "next day",
        "next week",
        "next 7",
        "expected sales",
        "expected revenue",
        "sales tomorrow",
        "revenue tomorrow",
    )
    return any(token in lowered for token in forecast_tokens)


def _resolve_time_window(message: str, default_period: str) -> tuple[pd.DataFrame, str, str]:
    lowered = _normalize(message)
    available_end = databoard_service.available_range()[1]

    hour_match = re.search(r"(?:last|past)\s+(\d+)\s*(hours?|hrs?|hr|h)\b", lowered)
    if hour_match:
        hours = max(1, int(hour_match.group(1)))
        start = available_end - pd.Timedelta(hours=hours)
        frame = databoard_service.DATE_INDEXED_DF.loc[start:available_end].reset_index()
        return frame, f"last_{hours}_hours", f"last {hours} hours"

    day_match = re.search(r"(?:last|past)\s+(\d+)\s*(days?|d)\b", lowered)
    if day_match:
        days = max(1, int(day_match.group(1)))
        start = available_end.normalize() - pd.Timedelta(days=days - 1)
        end = available_end.normalize() + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)
        frame = databoard_service.DATE_INDEXED_DF.loc[start:end].reset_index()
        return frame, f"last_{days}_days", f"last {days} days"

    if any(token in lowered for token in ("today", "current day")):
        start = available_end.normalize()
        end = available_end.normalize() + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)
        frame = databoard_service.DATE_INDEXED_DF.loc[start:end].reset_index()
        return frame, "today", "today"

    if any(token in lowered for token in ("now", "right now", "currently")):
        frame = databoard_service.operational_dataframe()
        return frame, "current_snapshot", "the current snapshot"

    effective_period = _infer_period(message, default_period)
    frame = databoard_service.filtered_dataframe(effective_period)  # type: ignore[arg-type]
    return frame, f"period={effective_period}", effective_period


def _time_grain(message: str, scope_key: str, period: str) -> str:
    lowered = _normalize(message)
    if scope_key.endswith("_hours") or any(token in lowered for token in ("hour", "hourly", "hrs", "hr ")):
        return "hour"
    if scope_key in {"today", "current_snapshot"}:
        return "hour"
    if scope_key in {"period=year", "last_365_days"} or period == "year":
        return "month"
    if scope_key in {"period=quarter", "last_90_days"} or period == "quarter":
        return "week"
    return "day"


def _relevant_columns(topics: set[str], entity_kind: str | None) -> list[str]:
    columns = ["TransDate", "LineTotal", "RQty", "Transaction"]
    if entity_kind == "location" or "location" in topics:
        columns.append("Location")
    if entity_kind == "category" or "category" in topics:
        columns.append("Category")
    if entity_kind == "subcategory" or "category" in topics:
        columns.append("Subcategory")
    if entity_kind == "product" or "product" in topics:
        columns.append("Product")
    if entity_kind == "machine" or "machine" in topics:
        columns.extend(["Device ID", "Location"])
    if "payment" in topics:
        columns.append("Payment Type")
    deduped: list[str] = []
    for column in columns:
        if column not in deduped:
            deduped.append(column)
    return deduped


def _preview_rows(frame: pd.DataFrame, columns: list[str], limit: int = 6) -> list[dict[str, object]]:
    visible_columns = [column for column in columns if column in frame.columns]
    if not visible_columns or frame.empty:
        return []

    preview = frame[visible_columns].sort_values("TransDate", ascending=False).head(limit).copy()
    for column in preview.columns:
        if pd.api.types.is_datetime64_any_dtype(preview[column]):
            preview[column] = preview[column].dt.strftime("%Y-%m-%d %H:%M")
    preview = preview.where(pd.notnull(preview), None)
    return preview.to_dict(orient="records")


def _matched_entities(message: str) -> dict[str, list[str]]:
    candidates = _entity_candidates()
    matches = {
        entity_type: _extract_matches(message, values)
        for entity_type, values in candidates.items()
    }
    return {key: values for key, values in matches.items() if values}


def _build_entity_details(frame: pd.DataFrame, matched_entities: dict[str, list[str]], period: str) -> dict[str, object]:
    entity_details: dict[str, object] = {}
    for location in matched_entities.get("location", []):
        detail = _location_detail(frame, location, period)
        if detail is not None:
            entity_details[f"location:{location}"] = detail
    for category in matched_entities.get("category", []):
        detail = _category_detail(frame, category, period)
        if detail is not None:
            entity_details[f"category:{category}"] = detail
    for subcategory in matched_entities.get("subcategory", []):
        detail = _subcategory_detail(frame, subcategory, period)
        if detail is not None:
            entity_details[f"subcategory:{subcategory}"] = detail
    for product in matched_entities.get("product", []):
        detail = _product_detail(frame, product, period)
        if detail is not None:
            entity_details[f"product:{product}"] = detail
    for machine in matched_entities.get("machine", []):
        detail = _machine_detail(frame, machine, period)
        if detail is not None:
            entity_details[f"machine:{machine}"] = detail
    return entity_details


def _finalize_response(
    response: dict[str, Any],
    *,
    message: str,
    requested_period: str,
    effective_period: str,
    frame: pd.DataFrame,
    scope_key: str,
    scope_label: str,
    route_strategy: str,
    entity_kind: str | None = None,
) -> dict[str, Any]:
    topics = _request_topics(message)
    matched_entities = _matched_entities(message)
    columns = _relevant_columns(topics, entity_kind)
    start = frame["TransDate"].min().strftime("%Y-%m-%d %H:%M") if not frame.empty else ""
    end = frame["TransDate"].max().strftime("%Y-%m-%d %H:%M") if not frame.empty else ""
    response["request_context"] = {
        "requested_period": requested_period,
        "resolved_period": effective_period,
        "resolved_scope": scope_key,
        "scope_label": scope_label,
        "time_grain": _time_grain(message, scope_key, effective_period),
        "start": start,
        "end": end,
        "row_count": int(len(frame)),
        "topics": sorted(topics),
        "matched_entities": matched_entities,
        "columns": [column for column in columns if column in frame.columns],
        "route_strategy": route_strategy,
    }
    response["evidence"] = {
        "preview_rows": _preview_rows(frame, columns),
        "matched_entity_details": _build_entity_details(frame, matched_entities, effective_period),
        "answer_payload": response.get("structured_data"),
    }
    return response


def _summary_context(period: str) -> dict[str, object]:
    frame = databoard_service.filtered_dataframe(period)  # type: ignore[arg-type]
    return {
        "period": period,
        "kpis": databoard_service.kpis(frame),
        "location_rankings": databoard_service.location_rankings(frame)[:8],
        "category_rankings": databoard_service.category_rankings(frame)[:8],
        "subcategory_rankings": databoard_service.subcategory_rankings(frame)[:8],
        "product_rankings": databoard_service.product_rankings(frame)[:8],
        "machine_rankings": databoard_service.machine_rankings(frame)[:8],
    }


def _entity_candidates() -> dict[str, list[str]]:
    frame = databoard_service.DF
    return {
        "location": sorted(frame["Location"].dropna().astype(str).unique().tolist()),
        "category": sorted(frame["Category"].dropna().astype(str).unique().tolist()),
        "subcategory": sorted(frame["Subcategory"].dropna().astype(str).unique().tolist()),
        "machine": sorted(frame["Device ID"].dropna().astype(str).unique().tolist()),
        "product": sorted(frame["Product"].dropna().astype(str).unique().tolist()),
    }


ENTITY_COLUMN_MAP = {
    "location": "Location",
    "category": "Category",
    "subcategory": "Subcategory",
    "product": "Product",
    "machine": "Device ID",
}


def _infer_entity_kind(message: str) -> str | None:
    lowered = _normalize(message)
    if any(token in lowered for token in ("machine", "machines", "device", "devices")):
        return "machine"
    if any(token in lowered for token in ("subcategory", "subcategories")):
        return "subcategory"
    if any(token in lowered for token in ("category", "categories")):
        return "category"
    if any(token in lowered for token in ("product", "products", "item", "items", "sku", "skus", "brand")):
        return "product"
    if any(token in lowered for token in ("location", "locations", "site", "sites", "place", "places")):
        return "location"
    return None


def _infer_metric(message: str, entity_kind: str | None) -> tuple[str, str]:
    lowered = _normalize(message)
    if any(token in lowered for token in ("best selling", "top selling", "most sold", "highest selling", "units sold", "sold most", "best seller")):
        return "units", "selling"
    if any(token in lowered for token in ("transaction", "orders", "purchases")):
        return "transactions", "transactions"
    if any(token in lowered for token in ("profit", "revenue", "grossing", "performing", "best", "top", "highest")):
        return "revenue", "performing"
    if entity_kind == "product":
        return "units", "selling"
    return "revenue", "performing"


def _ranking_direction(message: str) -> tuple[bool, str]:
    lowered = _normalize(message)
    if any(token in lowered for token in ("lowest", "worst", "least", "bottom", "underperform")):
        return True, "lowest"
    return False, "highest"


def _summarize_ranked_rows(grouped: pd.DataFrame, metric: str, limit: int = 5) -> str:
    rows: list[str] = []
    for entity_name, row in grouped.head(limit).iterrows():
        if metric == "units":
            detail = f"{int(row['metric_value'])} units"
        elif metric == "transactions":
            detail = f"{int(row['metric_value'])} transactions"
        else:
            detail = f"{float(row['metric_value']):.2f} USD"
        rows.append(f"{entity_name} ({detail})")
    return "; ".join(rows)


def _rank_entities(frame: pd.DataFrame, entity_kind: str, metric: str, ascending: bool) -> pd.DataFrame:
    entity_column = ENTITY_COLUMN_MAP[entity_kind]
    metric_map = {
        "revenue": ("LineTotal", "sum"),
        "units": ("RQty", "sum"),
        "transactions": ("Transaction", "count"),
    }
    metric_column, agg = metric_map[metric]
    grouped = (
        frame.groupby(entity_column)
        .agg(
            metric_value=(metric_column, agg),
            revenue=("LineTotal", "sum"),
            units=("RQty", "sum"),
            transactions=("Transaction", "count"),
        )
        .sort_values(["metric_value", "revenue", "transactions"], ascending=ascending)
    )
    return grouped


def _top_rows(rows: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
    return rows[:limit]


def _bottom_rows(rows: list[dict[str, Any]], limit: int = 5) -> list[dict[str, Any]]:
    return rows[-limit:] if rows else []


def _location_detail(frame: Any, location: str, period: str) -> dict[str, Any] | None:
    location_frame = frame[frame["Location"] == location]
    if location_frame.empty:
        return None
    top_categories = (
        location_frame.groupby("Category")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(5)
        .reset_index()
        .rename(columns={"Category": "name", "LineTotal": "revenue"})
    )
    top_products = (
        location_frame.groupby("Product")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(5)
        .reset_index()
        .rename(columns={"Product": "name", "LineTotal": "revenue"})
    )
    trend = databoard_service.revenue_series(period, location_frame)  # type: ignore[arg-type]
    return {
        "location": location,
        "revenue": round(float(location_frame["LineTotal"].sum()), 2),
        "transactions": int(location_frame["Transaction"].count()),
        "machines": int(location_frame["Device ID"].nunique()),
        "top_categories": top_categories.to_dict(orient="records"),
        "top_products": top_products.to_dict(orient="records"),
        "trend": trend[-8:],
    }


def _category_detail(frame: Any, category: str, period: str) -> dict[str, Any] | None:
    category_frame = frame[frame["Category"] == category]
    if category_frame.empty:
        return None
    top_subcategories = (
        category_frame.groupby("Subcategory")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(6)
        .reset_index()
        .rename(columns={"Subcategory": "name", "LineTotal": "revenue"})
    )
    top_products = (
        category_frame.groupby("Product")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(6)
        .reset_index()
        .rename(columns={"Product": "name", "LineTotal": "revenue"})
    )
    trend = databoard_service.revenue_series(period, category_frame)  # type: ignore[arg-type]
    return {
        "category": category,
        "revenue": round(float(category_frame["LineTotal"].sum()), 2),
        "transactions": int(category_frame["Transaction"].count()),
        "top_subcategories": top_subcategories.to_dict(orient="records"),
        "top_products": top_products.to_dict(orient="records"),
        "trend": trend[-8:],
    }


def _subcategory_detail(frame: Any, subcategory: str, period: str) -> dict[str, Any] | None:
    subcategory_frame = frame[frame["Subcategory"] == subcategory]
    if subcategory_frame.empty:
        return None
    top_products = (
        subcategory_frame.groupby("Product")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(6)
        .reset_index()
        .rename(columns={"Product": "name", "LineTotal": "revenue"})
    )
    top_locations = (
        subcategory_frame.groupby("Location")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(6)
        .reset_index()
        .rename(columns={"Location": "name", "LineTotal": "revenue"})
    )
    trend = databoard_service.revenue_series(period, subcategory_frame)  # type: ignore[arg-type]
    return {
        "subcategory": subcategory,
        "revenue": round(float(subcategory_frame["LineTotal"].sum()), 2),
        "transactions": int(subcategory_frame["Transaction"].count()),
        "top_products": top_products.to_dict(orient="records"),
        "top_locations": top_locations.to_dict(orient="records"),
        "trend": trend[-8:],
    }


def _product_detail(frame: Any, product: str, period: str) -> dict[str, Any] | None:
    product_frame = frame[frame["Product"] == product]
    if product_frame.empty:
        return None
    top_locations = (
        product_frame.groupby("Location")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(6)
        .reset_index()
        .rename(columns={"Location": "name", "LineTotal": "revenue"})
    )
    trend = databoard_service.revenue_series(period, product_frame)  # type: ignore[arg-type]
    first_row = product_frame.iloc[0]
    return {
        "product": product,
        "category": str(first_row["Category"]),
        "subcategory": str(first_row["Subcategory"]),
        "revenue": round(float(product_frame["LineTotal"].sum()), 2),
        "transactions": int(product_frame["Transaction"].count()),
        "units": int(product_frame["RQty"].sum()),
        "top_locations": top_locations.to_dict(orient="records"),
        "trend": trend[-8:],
    }


def _machine_detail(frame: Any, machine_id: str, period: str) -> dict[str, Any] | None:
    machine_frame = frame[frame["Device ID"] == machine_id]
    if machine_frame.empty:
        return None
    trend = databoard_service.revenue_series(period, machine_frame)  # type: ignore[arg-type]
    top_products = (
        machine_frame.groupby("Product")["LineTotal"]
        .sum()
        .sort_values(ascending=False)
        .head(5)
        .reset_index()
        .rename(columns={"Product": "name", "LineTotal": "revenue"})
    )
    return {
        "machine_id": machine_id,
        "location": str(machine_frame["Location"].mode().iat[0]),
        "revenue": round(float(machine_frame["LineTotal"].sum()), 2),
        "transactions": int(machine_frame["Transaction"].count()),
        "top_products": top_products.to_dict(orient="records"),
        "trend": trend[-8:],
    }


def _build_llm_context(message: str, period: str) -> dict[str, object]:
    frame, scope_key, scope_label = _resolve_time_window(message, period)
    candidates = _entity_candidates()
    topics = _request_topics(message)
    matched_entities = {
        entity_type: _extract_matches(message, values)
        for entity_type, values in candidates.items()
    }

    context: dict[str, object] = {
        "request_scope": {
            "period": period,
            "resolved_scope": scope_key,
            "resolved_label": scope_label,
            "topics": sorted(topics),
            "matched_entities": {key: values for key, values in matched_entities.items() if values},
            "filtered_range": {
                "start": frame["TransDate"].min().strftime("%Y-%m-%d %H:%M") if not frame.empty else "",
                "end": frame["TransDate"].max().strftime("%Y-%m-%d %H:%M") if not frame.empty else "",
            },
        },
        "kpis": databoard_service.kpis(frame),
    }

    if {"location", "comparison", "performance"} & topics:
        location_rows = databoard_service.location_rankings(frame)
        context["location_rankings"] = _top_rows(location_rows, 10)
        context["lowest_location_rankings"] = _bottom_rows(location_rows, 5)

    if {"category", "performance"} & topics:
        context["category_rankings"] = _top_rows(databoard_service.category_rankings(frame), 10)
        context["subcategory_rankings"] = _top_rows(databoard_service.subcategory_rankings(frame), 10)

    if {"product", "performance"} & topics:
        context["product_rankings"] = _top_rows(databoard_service.product_rankings(frame), 12)

    if {"machine", "performance"} & topics:
        context["machine_rankings"] = _top_rows(databoard_service.machine_rankings(frame), 12)
        context["restock_priority"] = _top_rows(databoard_service.restock_priority(frame, databoard_service.DF), 10)
        context["status_summary"] = databoard_service.status_summary(frame)

    if {"trend", "prediction"} & topics:
        context["revenue_series"] = databoard_service.revenue_series(period, frame)
        context["hourly_demand"] = databoard_service.hourly_demand(frame)
        context["weekday_demand"] = databoard_service.weekday_demand(frame)

    if "payment" in topics:
        context["payment_mix"] = databoard_service.payment_mix(frame)

    if {"prediction", "model"} & topics:
        model_registry = get_model_registry()
        context["model_registry"] = [
            {
                "model_name": item["model_name"],
                "model_type": item["model_type"],
                "task_type": item["task_type"],
                "scope": item["scope"],
                "target": item.get("target"),
                "metrics": item["metrics"],
                "trained_at": item["trained_at"],
            }
            for item in model_registry
        ]

    entity_details: dict[str, object] = {}
    for location in matched_entities["location"]:
        detail = _location_detail(frame, location, period)
        if detail is not None:
            entity_details[f"location:{location}"] = detail
    for category in matched_entities["category"]:
        detail = _category_detail(frame, category, period)
        if detail is not None:
            entity_details[f"category:{category}"] = detail
    for subcategory in matched_entities["subcategory"]:
        detail = _subcategory_detail(frame, subcategory, period)
        if detail is not None:
            entity_details[f"subcategory:{subcategory}"] = detail
    for product in matched_entities["product"]:
        detail = _product_detail(frame, product, period)
        if detail is not None:
            entity_details[f"product:{product}"] = detail
    for machine in matched_entities["machine"]:
        detail = _machine_detail(frame, machine, period)
        if detail is not None:
            entity_details[f"machine:{machine}"] = detail

    if entity_details:
        context["entity_details"] = entity_details

    return context


def _forecast_route(message: str, period: str) -> dict[str, Any]:
    frame, scope_key, scope_label = _resolve_time_window(message, period)
    effective_period = _infer_period(message, period)
    candidates = _entity_candidates()
    lowered = _normalize(message)
    horizon = 7 if any(token in lowered for token in ("7 day", "7-day", "week", "next 7")) else 1

    metric_label = "sales" if "sales" in lowered else "demand" if "demand" in lowered else "revenue"
    metric_answer_suffix = (
        " as a revenue forecast proxy for demand"
        if metric_label == "demand"
        else f" in {metric_label}"
    )

    machine = _extract_best_match(message, candidates["machine"])
    if machine:
        payload = forecast_entity("machine", machine, horizon_days=horizon)
        return _finalize_response({
            "mode": "local_model",
            "route": "forecast_machine",
            "answer": f"The trained machine forecaster expects {machine} to generate {payload['next_7d_revenue'] if horizon > 1 else payload['next_day_revenue']:.2f} USD{metric_answer_suffix} over the requested horizon.",
            "model_name": payload["model_name"],
            "model_type": payload["model_type"],
            "confidence": f"MAE {payload['metrics']['mae']} | RMSE {payload['metrics']['rmse']}",
            "data_scope": f"machine={machine}",
            "chart_hint": "line",
            "structured_data": payload,
        }, message=message, requested_period=period, effective_period=effective_period, frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="trained_model", entity_kind="machine")

    location = _extract_best_match(message, candidates["location"])
    if location:
        payload = forecast_entity("location", location, horizon_days=horizon)
        return _finalize_response({
            "mode": "local_model",
            "route": "forecast_location",
            "answer": f"The trained location forecaster expects {location} to generate {payload['next_7d_revenue'] if horizon > 1 else payload['next_day_revenue']:.2f} USD{metric_answer_suffix} over the requested horizon.",
            "model_name": payload["model_name"],
            "model_type": payload["model_type"],
            "confidence": f"MAE {payload['metrics']['mae']} | RMSE {payload['metrics']['rmse']}",
            "data_scope": f"location={location}",
            "chart_hint": "line",
            "structured_data": payload,
        }, message=message, requested_period=period, effective_period=effective_period, frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="trained_model", entity_kind="location")

    category = _extract_best_match(message, candidates["category"])
    if category:
        payload = forecast_entity("category", category, horizon_days=horizon)
        return _finalize_response({
            "mode": "local_model",
            "route": "forecast_category",
            "answer": f"The trained category forecaster expects {category} to generate {payload['next_7d_revenue'] if horizon > 1 else payload['next_day_revenue']:.2f} USD{metric_answer_suffix} over the requested horizon.",
            "model_name": payload["model_name"],
            "model_type": payload["model_type"],
            "confidence": f"MAE {payload['metrics']['mae']} | RMSE {payload['metrics']['rmse']}",
            "data_scope": f"category={category}",
            "chart_hint": "line",
            "structured_data": payload,
        }, message=message, requested_period=period, effective_period=effective_period, frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="trained_model", entity_kind="category")

    payload = forecast_entity("network", horizon_days=horizon)
    return _finalize_response({
        "mode": "local_model",
        "route": "forecast_network",
        "answer": f"The trained network forecaster expects {payload['next_7d_revenue'] if horizon > 1 else payload['next_day_revenue']:.2f} USD{metric_answer_suffix} over the requested horizon.",
        "model_name": payload["model_name"],
        "model_type": payload["model_type"],
        "confidence": f"MAE {payload['metrics']['mae']} | RMSE {payload['metrics']['rmse']}",
        "data_scope": "network",
        "chart_hint": "line",
        "structured_data": payload,
    }, message=message, requested_period=period, effective_period=effective_period, frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="trained_model")


def _risk_route(message: str, period: str) -> dict[str, Any]:
    frame, scope_key, scope_label = _resolve_time_window(message, period)
    machine = _extract_best_match(message, _entity_candidates()["machine"])
    payload = predict_machine_risk(machine_id=machine, top_n=8 if machine is None else 1)
    predictions = payload["predictions"]
    if not predictions:
        raise ValueError("No risk predictions available")
    if machine:
        item = predictions[0]
        answer = (
            f"Machine {item['machine_id']} at {item['location']} is classified as {item['risk_class']} risk "
            f"with probability {item['risk_probability']:.3f}."
        )
        scope = f"machine={machine}"
    else:
        top = predictions[0]
        answer = (
            f"The highest-risk machine is {top['machine_id']} at {top['location']} with probability "
            f"{top['risk_probability']:.3f}. I returned the top ranked risk list."
        )
        scope = "fleet_top_risk"

    return _finalize_response({
        "mode": "local_model",
        "route": "risk_classification",
        "answer": answer,
        "model_name": payload["model_name"],
        "model_type": payload["model_type"],
        "confidence": (
            f"Accuracy {payload['metrics']['accuracy']} | "
            f"Precision {payload['metrics']['precision']} | "
            f"Recall {payload['metrics']['recall']}"
        ),
        "data_scope": scope,
        "chart_hint": "bar",
        "structured_data": payload,
    }, message=message, requested_period=period, effective_period=_infer_period(message, period), frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="trained_model", entity_kind="machine")


def _cluster_route(message: str, period: str) -> dict[str, Any]:
    frame, scope_key, scope_label = _resolve_time_window(message, period)
    payload = get_location_segments()
    first_segment = payload["segments"][0]
    return _finalize_response({
        "mode": "local_model",
        "route": "location_clustering",
        "answer": (
            f"The trained clustering model grouped locations into {payload['metrics']['clusters']} behavioral segments. "
            f"For example, {first_segment['location']} is currently assigned to the '{first_segment['segment_name']}' segment."
        ),
        "model_name": payload["model_name"],
        "model_type": payload["model_type"],
        "confidence": f"Clusters {payload['metrics']['clusters']} across {payload['metrics']['locations']} locations",
        "data_scope": "location_segments",
        "chart_hint": "table",
        "structured_data": payload,
    }, message=message, requested_period=period, effective_period=_infer_period(message, period), frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="trained_model", entity_kind="location")


def _predictive_ranking_route(message: str, period: str) -> dict[str, Any] | None:
    lowered = _normalize(message)
    entity_kind = _infer_entity_kind(message)
    if entity_kind not in {"category", "location", "machine"}:
        return None
    if not any(token in lowered for token in ("will", "next", "tomorrow", "future", "forecast", "predict", "expected", "projected")):
        return None
    if not any(token in lowered for token in ("best", "top", "highest", "will do best", "will perform best", "strongest")):
        return None

    horizon = 7 if any(token in lowered for token in ("7 day", "7-day", "week", "next 7", "next week")) else 1
    scope_map = {"category": "category", "location": "location", "machine": "machine"}
    candidate_map = _entity_candidates()
    candidates = candidate_map[entity_kind]
    predictions: list[dict[str, Any]] = []
    for candidate in candidates:
        try:
            payload = forecast_entity(scope_map[entity_kind], candidate, horizon_days=horizon)
        except Exception:
            continue
        predictions.append(
            {
                "name": candidate,
                "next_day_revenue": float(payload["next_day_revenue"]),
                "next_7d_revenue": float(payload["next_7d_revenue"]),
            }
        )

    if not predictions:
        return None

    target_key = "next_7d_revenue" if horizon > 1 else "next_day_revenue"
    ranked = sorted(predictions, key=lambda item: item[target_key], reverse=True)
    top = ranked[0]
    frame, scope_key, scope_label = _resolve_time_window(message, period)
    effective_period = _infer_period(message, period)
    noun = {"category": "category", "location": "location", "machine": "machine"}[entity_kind]
    horizon_label = "next 7 days" if horizon > 1 else "tomorrow"
    return _finalize_response(
        {
            "mode": "local_model",
            "route": f"forecast_best_{entity_kind}",
            "answer": f"The trained {noun} forecaster expects {top['name']} to perform best for {horizon_label}, with a forecast of {top[target_key]:.2f} USD.",
            "model_name": f"{noun.title()} comparative forecast",
            "model_type": "forecast ranking",
            "confidence": None,
            "data_scope": scope_key,
            "chart_hint": "bar",
            "structured_data": {
                "entity_kind": entity_kind,
                "horizon_days": horizon,
                "ranked_predictions": ranked[:8],
            },
        },
        message=message,
        requested_period=period,
        effective_period=effective_period,
        frame=frame,
        scope_key=scope_key,
        scope_label=scope_label,
        route_strategy="trained_model",
        entity_kind=entity_kind,
    )


def _analytics_route(message: str, period: str) -> dict[str, Any] | None:
    frame, scope_key, scope_label = _resolve_time_window(message, period)
    effective_period = _infer_period(message, period)
    lowered = _normalize(message)
    entity_kind = _infer_entity_kind(message)
    metric, metric_label = _infer_metric(message, entity_kind)
    ascending, direction_label = _ranking_direction(message)

    if any(token in lowered for token in ("compare", "show", "list")) and entity_kind in ENTITY_COLUMN_MAP:
        grouped = _rank_entities(frame, entity_kind, metric, ascending=ascending)
        if grouped.empty:
            return None
        summary = _summarize_ranked_rows(grouped, metric)
        ranking_label = "bottom" if ascending else "top"
        return _finalize_response({
            "mode": "local_analytics",
            "route": f"compare_{entity_kind}_rankings",
            "answer": f"The {ranking_label} {entity_kind} rankings in {scope_label} are: {summary}.",
            "model_name": None,
            "model_type": "descriptive analytics",
            "confidence": None,
            "data_scope": scope_key,
            "chart_hint": "bar",
            "structured_data": [
                {
                    "name": str(entity_name),
                    "metric": metric,
                    "metric_value": int(row["metric_value"]) if metric != "revenue" else round(float(row["metric_value"]), 2),
                    "revenue": round(float(row["revenue"]), 2),
                    "units": int(row["units"]),
                    "transactions": int(row["transactions"]),
                }
                for entity_name, row in grouped.head(5).iterrows()
            ],
        }, message=message, requested_period=period, effective_period=effective_period, frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="deterministic_analytics", entity_kind=entity_kind)

    if entity_kind in ENTITY_COLUMN_MAP and any(
        token in lowered
        for token in (
            "best",
            "top",
            "highest",
            "lowest",
            "worst",
            "most",
            "least",
            "selling",
            "performing",
            "profit",
            "revenue",
            "sold",
            "assistance",
            "attention",
        )
    ):
        grouped = _rank_entities(frame, entity_kind, metric, ascending=ascending)
        if grouped.empty:
            return None
        entity_name = str(grouped.index[0])
        row = grouped.iloc[0]
        noun = {
            "location": "location",
            "category": "category",
            "subcategory": "subcategory",
            "product": "product",
            "machine": "machine",
        }[entity_kind]
        metric_value = int(row["metric_value"]) if metric == "units" else round(float(row["metric_value"]), 2)
        metric_phrase = f"{metric_value} units sold" if metric == "units" else f"{metric_value:.2f} USD in revenue" if metric == "revenue" else f"{int(row['metric_value'])} transactions"
        return _finalize_response({
            "mode": "local_analytics",
            "route": f"{direction_label}_{metric_label}_{entity_kind}",
            "answer": f"The {direction_label} {metric_label} {noun} in {scope_label} is {entity_name} with {metric_phrase}.",
            "model_name": None,
            "model_type": "descriptive analytics",
            "confidence": None,
            "data_scope": scope_key,
            "chart_hint": "bar",
            "structured_data": {
                "name": entity_name,
                "metric": metric,
                "metric_value": metric_value,
                "revenue": round(float(row["revenue"]), 2),
                "units": int(row["units"]),
                "transactions": int(row["transactions"]),
            },
        }, message=message, requested_period=period, effective_period=effective_period, frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="deterministic_analytics", entity_kind=entity_kind)

    if any(token in lowered for token in ("best selling product", "best-selling product", "top selling product", "top-selling product", "most sold product", "highest selling product")):
        grouped = (
            frame.groupby("Product")
            .agg(units=("RQty", "sum"), revenue=("LineTotal", "sum"), transactions=("Transaction", "count"))
            .sort_values(["units", "revenue", "transactions"], ascending=False)
        )
        if grouped.empty:
            return None
        product_name = str(grouped.index[0])
        row = grouped.iloc[0]
        return _finalize_response({
            "mode": "local_analytics",
            "route": "best_selling_product",
            "answer": (
                f"The best-selling product in the selected window is {product_name} with "
                f"{int(row['units'])} units sold and {float(row['revenue']):.2f} USD in revenue."
            ),
            "model_name": None,
            "model_type": "descriptive analytics",
            "confidence": None,
            "data_scope": scope_key,
            "chart_hint": "bar",
            "structured_data": {
                "name": product_name,
                "units": int(row["units"]),
                "revenue": round(float(row["revenue"]), 2),
                "transactions": int(row["transactions"]),
            },
        }, message=message, requested_period=period, effective_period=effective_period, frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="deterministic_analytics", entity_kind="product")

    if any(token in lowered for token in ("top location", "highest profit place", "best location", "most profitable location")):
        top = databoard_service.location_rankings(frame)[0]
        return _finalize_response({
            "mode": "local_analytics",
            "route": "top_location",
            "answer": f"The highest-profit location in the selected period is {top['name']} with revenue of {top['revenue']:.2f} USD.",
            "model_name": None,
            "model_type": "descriptive analytics",
            "confidence": None,
            "data_scope": scope_key,
            "chart_hint": "bar",
            "structured_data": top,
        }, message=message, requested_period=period, effective_period=effective_period, frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="deterministic_analytics", entity_kind="location")
    if any(token in lowered for token in ("top category", "highest profit category", "best category")):
        top = databoard_service.category_rankings(frame)[0]
        return _finalize_response({
            "mode": "local_analytics",
            "route": "top_category",
            "answer": f"The highest-profit category in the selected period is {top['name']} with revenue of {top['revenue']:.2f} USD.",
            "model_name": None,
            "model_type": "descriptive analytics",
            "confidence": None,
            "data_scope": scope_key,
            "chart_hint": "bar",
            "structured_data": top,
        }, message=message, requested_period=period, effective_period=effective_period, frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="deterministic_analytics", entity_kind="category")
    if any(token in lowered for token in ("top product", "highest profit product", "best product")):
        top = databoard_service.product_rankings(frame)[0]
        return _finalize_response({
            "mode": "local_analytics",
            "route": "top_product",
            "answer": f"The highest-profit product in the selected period is {top['name']} with revenue of {top['revenue']:.2f} USD.",
            "model_name": None,
            "model_type": "descriptive analytics",
            "confidence": None,
            "data_scope": scope_key,
            "chart_hint": "bar",
            "structured_data": top,
        }, message=message, requested_period=period, effective_period=effective_period, frame=frame, scope_key=scope_key, scope_label=scope_label, route_strategy="deterministic_analytics", entity_kind="product")
    return None


def _context_only_route(message: str, period: str) -> dict[str, Any]:
    frame, scope_key, scope_label = _resolve_time_window(message, period)
    effective_period = _infer_period(message, period)
    summary = databoard_service.kpis(frame)
    structured = {
        "top_location": summary["top_location"],
        "top_category": summary["top_category"],
        "top_product": summary["top_product"],
    }
    return _finalize_response(
        {
            "mode": "scoped_context",
            "route": "scoped_context_summary",
            "answer": (
                f"I could not match that to a dedicated model route, so I used the exact data slice for {scope_label}. "
                f"Within that slice, the top location is {summary['top_location']['name']}, the top category is {summary['top_category']['name']}, "
                f"and the top product is {summary['top_product']['name']}."
            ),
            "model_name": None,
            "model_type": "context summary",
            "confidence": None,
            "data_scope": scope_key,
            "chart_hint": None,
            "structured_data": structured,
        },
        message=message,
        requested_period=period,
        effective_period=effective_period,
        frame=frame,
        scope_key=scope_key,
        scope_label=scope_label,
        route_strategy="scoped_context",
    )


def _weak_products_route(message: str, period: str) -> dict[str, Any]:
    frame, scope_key, scope_label = _resolve_time_window(message, period)
    effective_period = _infer_period(message, period)
    grouped = (
        frame.groupby(["Product", "Category", "Subcategory"])
        .agg(revenue=("LineTotal", "sum"), units=("RQty", "sum"), transactions=("Transaction", "count"))
        .reset_index()
    )
    if grouped.empty:
        raise ValueError("No product data available for this time window.")

    active = grouped[grouped["transactions"] >= max(2, int(grouped["transactions"].quantile(0.25)))]
    if active.empty:
        active = grouped
    weakest = active.sort_values(["revenue", "transactions", "units"], ascending=[True, True, True]).head(5)
    items = [
        {
            "name": str(row.Product),
            "category": str(row.Category),
            "subcategory": str(row.Subcategory),
            "revenue": round(float(row.revenue), 2),
            "units": int(row.units),
            "transactions": int(row.transactions),
        }
        for row in weakest.itertuples()
    ]
    summary = "; ".join(f"{item['name']} (${item['revenue']:.2f}, {item['transactions']} txns)" for item in items[:3])
    return _finalize_response(
        {
            "mode": "local_analytics",
            "route": "weak_products",
            "answer": f"The weakest active products in {scope_label} are {summary}. I returned the bottom product list using revenue and transaction volume from the selected slice.",
            "model_name": None,
            "model_type": "descriptive analytics",
            "confidence": None,
            "data_scope": scope_key,
            "chart_hint": "table",
            "structured_data": items,
        },
        message=message,
        requested_period=period,
        effective_period=effective_period,
        frame=frame,
        scope_key=scope_key,
        scope_label=scope_label,
        route_strategy="diagnostic_analytics",
        entity_kind="product",
    )


def _location_diagnosis_route(message: str, period: str) -> dict[str, Any] | None:
    frame, scope_key, scope_label = _resolve_time_window(message, period)
    effective_period = _infer_period(message, period)
    location = _extract_best_match(message, _entity_candidates()["location"])
    if not location:
        return None

    location_metrics = databoard_service.location_map(frame)
    location_item = next((item for item in location_metrics if item["name"] == location), None)
    if location_item is None:
        return None

    detail = _location_detail(frame, location, effective_period)
    if detail is None:
        return None

    network_revenue_avg = float(sum(float(item["revenue"]) for item in location_metrics) / max(len(location_metrics), 1))
    network_txn_avg = float(sum(float(item["transactions"]) for item in location_metrics) / max(len(location_metrics), 1))
    network_avg_ticket = float(frame["LineTotal"].sum() / max(frame["Transaction"].count(), 1))
    revenue_gap = round(float(location_item["revenue"]) - network_revenue_avg, 2)
    txn_gap = round(float(location_item["transactions"]) - network_txn_avg, 2)
    avg_ticket = round(float(location_item["average_ticket"]), 2)
    avg_ticket_gap = round(avg_ticket - network_avg_ticket, 2)
    top_category = detail["top_categories"][0]["name"] if detail["top_categories"] else "N/A"
    top_category_share = 0.0
    if detail["revenue"]:
        top_category_share = round(float(detail["top_categories"][0]["revenue"]) / float(detail["revenue"]) * 100, 1) if detail["top_categories"] else 0.0
    trend_points = detail["trend"]
    trend_delta = 0.0
    if len(trend_points) >= 2:
        earlier = float(trend_points[0]["revenue"])
        latest = float(trend_points[-1]["revenue"])
        if earlier > 0:
            trend_delta = round(((latest - earlier) / earlier) * 100, 1)

    active_days = int(frame[frame["Location"] == location]["DateOnly"].nunique())
    network_median_active_days = int(frame.groupby("Location")["DateOnly"].nunique().median()) if not frame.empty else 0
    ranked_locations = sorted(location_metrics, key=lambda item: float(item["revenue"]), reverse=True)
    revenue_rank = next((idx for idx, item in enumerate(ranked_locations, 1) if item["name"] == location), len(ranked_locations))
    productivity_rankings = sorted(
        location_metrics,
        key=lambda item: float(item["revenue"]) / max(int(item["machine_count"]), 1),
        reverse=True,
    )
    productivity_rank = next((idx for idx, item in enumerate(productivity_rankings, 1) if item["name"] == location), len(productivity_rankings))

    drivers = []
    if revenue_rank >= max(3, len(ranked_locations) - 2):
        drivers.append(f"it ranks {revenue_rank} out of {len(ranked_locations)} locations on revenue")
    if productivity_rank >= max(3, len(productivity_rankings) - 2):
        drivers.append(f"it ranks {productivity_rank} out of {len(productivity_rankings)} on revenue per machine")
    if revenue_gap < 0:
        drivers.append(f"revenue is ${abs(revenue_gap):,.0f} below the network location average")
    if txn_gap < 0:
        drivers.append(f"transactions are {abs(int(txn_gap))} below the network location average")
    if avg_ticket_gap < 0:
        drivers.append(f"average ticket is ${abs(avg_ticket_gap):.2f} below the network average")
    if active_days < network_median_active_days:
        drivers.append(f"the site only sold on {active_days} active days versus a network median of {network_median_active_days}")
    if top_category_share >= 45:
        drivers.append(f"demand is concentrated in {top_category} ({top_category_share:.1f}% of location revenue)")
    else:
        drivers.append(f"no category is dominant enough to act as a hero driver, with {top_category} contributing only {top_category_share:.1f}% of revenue")
    if trend_delta < 0:
        drivers.append(f"recent trend is down {abs(trend_delta):.1f}% across the selected series")
    if not drivers:
        drivers.append("the location is not materially weak on the selected metrics, so the issue may be relative ranking rather than a clear structural drop")

    structured = {
        "location": location,
        "revenue": round(float(location_item["revenue"]), 2),
        "transactions": int(location_item["transactions"]),
        "machine_count": int(location_item["machine_count"]),
        "network_average_revenue": round(network_revenue_avg, 2),
        "network_average_transactions": round(network_txn_avg, 2),
        "network_average_ticket": round(network_avg_ticket, 2),
        "revenue_gap_vs_average": revenue_gap,
        "transactions_gap_vs_average": txn_gap,
        "average_ticket": avg_ticket,
        "average_ticket_gap_vs_average": avg_ticket_gap,
        "active_days": active_days,
        "network_median_active_days": network_median_active_days,
        "revenue_rank": revenue_rank,
        "productivity_rank": productivity_rank,
        "location_count": len(ranked_locations),
        "trend_delta_pct": trend_delta,
        "top_category": top_category,
        "top_category_share": top_category_share,
        "drivers": drivers,
    }
    response = _finalize_response(
        {
            "mode": "local_analytics",
            "route": "location_diagnosis",
            "answer": (
                f"{location} is weak in {scope_label} because it ranks {revenue_rank} of {len(ranked_locations)} on revenue and "
                f"{productivity_rank} of {len(productivity_rankings)} on revenue per machine. "
                f"It is seeing low traffic ({int(location_item['transactions'])} transactions), a smaller average ticket (${avg_ticket:.2f}), "
                f"and fewer active selling days ({active_days}) than the network norm."
            ),
            "model_name": None,
            "model_type": "diagnostic analytics",
            "confidence": None,
            "data_scope": f"location={location}",
            "chart_hint": "table",
            "structured_data": structured,
        },
        message=message,
        requested_period=period,
        effective_period=effective_period,
        frame=frame,
        scope_key=scope_key,
        scope_label=scope_label,
        route_strategy="diagnostic_analytics",
        entity_kind="location",
    )
    response["request_context"]["matched_entities"] = {"location": [location]}
    response["evidence"]["matched_entity_details"] = {f"location:{location}": detail}
    return response


def _new_machine_recommendation_route(message: str, period: str) -> dict[str, Any]:
    frame, scope_key, scope_label = _resolve_time_window(message, period)
    effective_period = _infer_period(message, period)
    locations = pd.DataFrame(databoard_service.location_map(frame))
    if locations.empty:
        raise ValueError("No location data available for expansion analysis.")

    locations["revenue_per_machine"] = locations["revenue"] / locations["machine_count"].clip(lower=1)
    locations["transactions_per_machine"] = locations["transactions"] / locations["machine_count"].clip(lower=1)
    revenue_max = float(locations["revenue_per_machine"].max() or 1.0)
    txn_max = float(locations["transactions_per_machine"].max() or 1.0)
    share_max = float(locations["share"].max() or 1.0)
    locations["expansion_score"] = (
        (locations["revenue_per_machine"] / revenue_max) * 0.5
        + (locations["transactions_per_machine"] / txn_max) * 0.3
        + (locations["share"] / share_max) * 0.2
    ) * 100
    ranked = locations.sort_values(["expansion_score", "revenue_per_machine", "transactions"], ascending=False).head(5)
    items = [
        {
            "name": str(row["name"]),
            "revenue": round(float(row["revenue"]), 2),
            "transactions": int(row["transactions"]),
            "machine_count": int(row["machine_count"]),
            "revenue_per_machine": round(float(row["revenue_per_machine"]), 2),
            "transactions_per_machine": round(float(row["transactions_per_machine"]), 2),
            "share": round(float(row["share"]), 2),
            "top_category": str(row["top_category"]),
            "expansion_score": round(float(row["expansion_score"]), 2),
        }
        for _, row in ranked.iterrows()
    ]
    lead = items[0]
    answer = (
        f"The strongest current candidates for additional machines in {scope_label} are led by {lead['name']}. "
        f"I ranked locations by revenue per machine, transactions per machine, and revenue share to identify sites with the strongest incremental demand signal."
    )
    return _finalize_response(
        {
            "mode": "local_analytics",
            "route": "new_machine_recommendation",
            "answer": answer,
            "model_name": None,
            "model_type": "prescriptive analytics",
            "confidence": None,
            "data_scope": scope_key,
            "chart_hint": "table",
            "structured_data": items,
        },
        message=message,
        requested_period=period,
        effective_period=effective_period,
        frame=frame,
        scope_key=scope_key,
        scope_label=scope_label,
        route_strategy="prescriptive_analytics",
        entity_kind="location",
    )


def answer_chat(message: str, period: str = "month") -> dict[str, Any]:
    lowered = _normalize(message)
    if not lowered:
        raise ValueError("Message is required")
    effective_period = _infer_period(message, period)
    context_frame, scope_key, scope_label = _resolve_time_window(message, period)

    if any(token in lowered for token in ("model", "registry", "what models", "trained models")):
        registry = get_model_registry()
        return _finalize_response({
            "mode": "local_model",
            "route": "model_registry",
            "answer": f"There are {len(registry)} trained local models available, covering forecasting, classification, and clustering.",
            "model_name": "Model Registry",
            "model_type": "registry",
            "confidence": None,
            "data_scope": "all_models",
            "chart_hint": "table",
            "structured_data": registry,
        }, message=message, requested_period=period, effective_period=effective_period, frame=context_frame, scope_key=scope_key, scope_label=scope_label, route_strategy="trained_model")

    if any(token in lowered for token in ("risk", "at risk", "restock", "service first", "critical machine", "assistance", "attention", "assist", "priority")):
        return _risk_route(message, period)

    predictive_ranking = _predictive_ranking_route(message, period)
    if predictive_ranking is not None:
        return predictive_ranking

    if _is_forecast_request(message):
        return _forecast_route(message, period)

    if any(token in lowered for token in ("cluster", "segment", "group similar locations")):
        return _cluster_route(message, period)

    if any(token in lowered for token in ("doing bad", "performing bad", "performing poorly", "underperforming products", "weak products", "bad products", "poor products")) and any(
        token in lowered for token in ("product", "products", "item", "items", "sku", "skus")
    ):
        return _weak_products_route(message, period)

    if any(token in lowered for token in ("why is", "why are", "why does", "why do")):
        diagnosis = _location_diagnosis_route(message, period)
        if diagnosis is not None:
            return diagnosis

    if any(token in lowered for token in ("where should we add new machines", "where should we add machines", "where to add new machines", "where to add machines", "best places for new machines", "new machine placement", "expand machines", "add more machines")):
        return _new_machine_recommendation_route(message, period)

    analytics_answer = _analytics_route(message, period)
    if analytics_answer is not None:
        return analytics_answer

    fallback_context = _build_llm_context(message, effective_period)
    llm_answer = generate_context_bound_answer(message, fallback_context)
    if llm_answer is not None:
        return _finalize_response({
            "mode": "llm_fallback",
            "route": "llm_context_fallback",
            "answer": llm_answer["answer"],
            "model_name": llm_answer["model"],
            "model_type": f"{llm_answer['provider']} chat completion",
            "confidence": "Context-bound fallback only",
            "data_scope": f"period={effective_period}",
            "chart_hint": None,
            "structured_data": None,
        }, message=message, requested_period=period, effective_period=effective_period, frame=context_frame, scope_key=scope_key, scope_label=scope_label, route_strategy="llm_context_fallback")

    provider_configured = bool(settings.OPENAI_API_KEY or settings.GROQ_API_KEY)
    context_response = _context_only_route(message, period)
    if provider_configured:
        context_response["confidence"] = "External fallback unavailable, using scoped dashboard context"
    return context_response
