from __future__ import annotations

import hashlib
from typing import Literal, TypedDict

import pandas as pd

from app.core.config import settings
from app.services.taxonomy import enrich_product_taxonomy


Period = Literal["week", "month", "quarter", "year"]


class SummaryFilters(TypedDict, total=False):
    location: str
    category: str
    subcategory: str
    product: str
    machine_id: str
    weekday_index: int
    hour: int
    payment_type: str

METRO_ANCHORS = (
    (40.7128, -74.0060),
    (34.0522, -118.2437),
    (41.8781, -87.6298),
    (29.7604, -95.3698),
    (33.4484, -112.0740),
    (47.6062, -122.3321),
    (39.9526, -75.1652),
    (32.7767, -96.7970),
    (38.9072, -77.0369),
    (42.3601, -71.0589),
)


def _stable_coordinates(location: str) -> tuple[float, float]:
    digest = hashlib.sha256(location.encode("utf-8")).digest()
    base_lat, base_lon = METRO_ANCHORS[digest[0] % len(METRO_ANCHORS)]
    lat_offset = ((digest[1] / 255) - 0.5) * 1.4
    lon_offset = ((digest[2] / 255) - 0.5) * 1.8
    return round(base_lat + lat_offset, 4), round(base_lon + lon_offset, 4)


def _load_dataframe() -> pd.DataFrame:
    frame = pd.read_csv(settings.dataset_path)
    frame["TransDate"] = pd.to_datetime(frame["TransDate"], errors="coerce")
    frame["Prcd Date"] = pd.to_datetime(frame["Prcd Date"], errors="coerce")
    frame["LineTotal"] = pd.to_numeric(frame["LineTotal"], errors="coerce").fillna(0.0)
    frame["RQty"] = pd.to_numeric(frame["RQty"], errors="coerce").fillna(0)
    frame["RPrice"] = pd.to_numeric(frame["RPrice"], errors="coerce").fillna(0.0)
    frame["Transaction"] = pd.to_numeric(frame["Transaction"], errors="coerce").fillna(0).astype("int64")
    frame = frame.dropna(subset=["TransDate"]).sort_values("TransDate").copy()
    frame = enrich_product_taxonomy(frame)
    frame["DateOnly"] = frame["TransDate"].dt.normalize()
    frame["Hour"] = frame["TransDate"].dt.hour
    frame["WeekdayIndex"] = frame["TransDate"].dt.weekday
    frame["WeekdayLabel"] = pd.Categorical(
        frame["TransDate"].dt.day_name().str.slice(stop=3),
        categories=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        ordered=True,
    )
    frame["MonthLabel"] = frame["TransDate"].dt.strftime("%b %Y")
    return frame


DF = _load_dataframe()
DATE_INDEXED_DF = DF.set_index("TransDate")


def available_range() -> tuple[pd.Timestamp, pd.Timestamp]:
    return DATE_INDEXED_DF.index.min(), DATE_INDEXED_DF.index.max()


def _period_bounds(period: Period) -> tuple[pd.Timestamp, pd.Timestamp]:
    available_start, available_end = available_range()
    end = available_end.normalize()
    if period == "week":
        start = end - pd.Timedelta(days=6)
    elif period == "month":
        start = end - pd.Timedelta(days=29)
    elif period == "quarter":
        start = end - pd.Timedelta(days=89)
    else:
        start = end - pd.Timedelta(days=364)
    start = max(start, available_start.normalize())
    return start, end


def operational_bounds() -> tuple[pd.Timestamp, pd.Timestamp]:
    available_start, available_end = available_range()
    end = available_end.normalize()
    start = max(end - pd.Timedelta(days=6), available_start.normalize())
    return start, end


def _apply_filters(frame: pd.DataFrame, filters: SummaryFilters | None = None) -> pd.DataFrame:
    if not filters:
        return frame

    filtered = frame
    if filters.get("location"):
        filtered = filtered[filtered["Location"] == filters["location"]]
    if filters.get("category"):
        filtered = filtered[filtered["Category"] == filters["category"]]
    if filters.get("subcategory"):
        filtered = filtered[filtered["Subcategory"] == filters["subcategory"]]
    if filters.get("product"):
        filtered = filtered[filtered["Product"] == filters["product"]]
    if filters.get("machine_id"):
        filtered = filtered[filtered["Device ID"] == filters["machine_id"]]
    if filters.get("weekday_index") is not None:
        filtered = filtered[filtered["WeekdayIndex"] == filters["weekday_index"]]
    if filters.get("hour") is not None:
        filtered = filtered[filtered["Hour"] == filters["hour"]]
    if filters.get("payment_type"):
        filtered = filtered[filtered["Type"] == filters["payment_type"]]
    return filtered.copy()


def filtered_dataframe(period: Period, filters: SummaryFilters | None = None) -> pd.DataFrame:
    start, end = _period_bounds(period)
    frame = DATE_INDEXED_DF.loc[start : end + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)].reset_index()
    return _apply_filters(frame, filters)


def operational_dataframe(filters: SummaryFilters | None = None) -> pd.DataFrame:
    start, end = operational_bounds()
    frame = DATE_INDEXED_DF.loc[start : end + pd.Timedelta(days=1) - pd.Timedelta(seconds=1)].reset_index()
    return _apply_filters(frame, filters)


def _safe_share(value: float, total: float) -> float:
    return round((value / total) * 100, 2) if total else 0.0


def _status_from_utilization(utilization: float) -> str:
    if utilization >= 70:
        return "healthy"
    if utilization >= 40:
        return "warning"
    return "critical"


def _series_frequency(period: Period) -> tuple[str, str]:
    if period == "week":
        return "D", "%a %d"
    if period == "month":
        return "W-SUN", "%b %d"
    return "MS", "%b %Y"


def date_range_payload(start: pd.Timestamp, end: pd.Timestamp) -> dict[str, str]:
    return {"start": start.strftime("%Y-%m-%d"), "end": end.strftime("%Y-%m-%d")}


def revenue_series(period: Period, frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    if frame.empty:
        return []

    freq, label_fmt = _series_frequency(period)
    date_indexed = frame.set_index("TransDate").sort_index()
    revenue = date_indexed["LineTotal"].resample(freq).sum()
    txns = date_indexed["Transaction"].resample(freq).count()

    if period == "week":
        start, end = _period_bounds(period)
        index = pd.date_range(start, end, freq="D")
        revenue = revenue.reindex(index, fill_value=0.0)
        txns = txns.reindex(index, fill_value=0)

    return [
        {
            "label": timestamp.strftime(label_fmt),
            "revenue": round(float(revenue_value), 2),
            "transactions": int(txn_value),
        }
        for timestamp, revenue_value, txn_value in zip(revenue.index, revenue.tolist(), txns.tolist(), strict=True)
    ]


def hourly_demand(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    grouped = frame.groupby("Hour").agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"))
    return [
        {
            "hour": hour,
            "label": f"{hour:02d}:00",
            "revenue": round(float(grouped.loc[hour, "revenue"]) if hour in grouped.index else 0.0, 2),
            "transactions": int(grouped.loc[hour, "transactions"]) if hour in grouped.index else 0,
        }
        for hour in range(24)
    ]


def weekday_demand(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    grouped = frame.groupby("WeekdayIndex").agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"))
    return [
        {
            "day_index": day_index,
            "label": labels[day_index],
            "revenue": round(float(grouped.loc[day_index, "revenue"]) if day_index in grouped.index else 0.0, 2),
            "transactions": int(grouped.loc[day_index, "transactions"]) if day_index in grouped.index else 0,
        }
        for day_index in range(7)
    ]


def payment_mix(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    grouped = (
        frame.groupby("Type")
        .agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"))
        .sort_values("revenue", ascending=False)
    )
    total_revenue = float(grouped["revenue"].sum())
    return [
        {
            "name": str(payment_type),
            "revenue": round(float(row.revenue), 2),
            "transactions": int(row.transactions),
            "share": _safe_share(float(row.revenue), total_revenue),
        }
        for payment_type, row in grouped.iterrows()
    ]


def machine_utilization(frame: pd.DataFrame) -> dict[str, float]:
    machine_counts = frame.groupby("Device ID")["Transaction"].count()
    if machine_counts.empty or machine_counts.max() == 0:
        return {}
    utilization = (machine_counts / machine_counts.max()) * 100
    return {str(machine_id): round(float(value), 2) for machine_id, value in utilization.items()}


def status_summary(frame: pd.DataFrame) -> dict[str, int]:
    utilization = machine_utilization(frame)
    values = list(utilization.values())
    return {
        "total": len(values),
        "healthy": sum(value >= 70 for value in values),
        "warning": sum(40 <= value < 70 for value in values),
        "critical": sum(value < 40 for value in values),
    }


def utilization_bands(frame: pd.DataFrame) -> list[dict[str, int | str]]:
    values = list(machine_utilization(frame).values())
    bins = [
        ("0-20%", 0, 20),
        ("20-40%", 20, 40),
        ("40-60%", 40, 60),
        ("60-80%", 60, 80),
        ("80-100%", 80, 101),
    ]
    payload: list[dict[str, int | str]] = []
    for label, low, high in bins:
        count = sum(low <= value < high for value in values)
        payload.append({"label": label, "count": count})
    return payload


def top_kpi_item(grouped: pd.Series, subtitle_label: str) -> dict[str, float | str]:
    total = float(grouped.sum())
    if grouped.empty:
        return {"name": "N/A", "revenue": 0.0, "share": 0.0, "subtitle": "No data"}
    name = str(grouped.index[0])
    revenue = float(grouped.iloc[0])
    return {
        "name": name,
        "revenue": round(revenue, 2),
        "share": _safe_share(revenue, total),
        "subtitle": f"{subtitle_label}: ${revenue:,.0f}",
    }


def _category_metrics(frame: pd.DataFrame) -> pd.DataFrame:
    return (
        frame.groupby("Category")
        .agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"), units=("RQty", "sum"))
        .sort_values("revenue", ascending=False)
    )


def category_rankings(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    grouped = _category_metrics(frame)
    total_revenue = float(grouped["revenue"].sum())
    return [
        {
            "name": str(index),
            "revenue": round(float(row.revenue), 2),
            "share": _safe_share(float(row.revenue), total_revenue),
            "transactions": int(row.transactions),
            "units": int(row.units),
        }
        for index, row in grouped.iterrows()
    ]


def subcategory_rankings(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    grouped = (
        frame.groupby(["Subcategory", "Category"])
        .agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"), units=("RQty", "sum"))
        .sort_values("revenue", ascending=False)
    )
    total_revenue = float(grouped["revenue"].sum())
    return [
        {
            "name": str(subcategory),
            "category": str(category),
            "revenue": round(float(row.revenue), 2),
            "share": _safe_share(float(row.revenue), total_revenue),
            "transactions": int(row.transactions),
            "units": int(row.units),
        }
        for (subcategory, category), row in grouped.head(15).iterrows()
    ]


def product_rankings(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    grouped = (
        frame.groupby(["Product", "Category", "Subcategory"])
        .agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"), units=("RQty", "sum"))
        .sort_values("revenue", ascending=False)
    )
    total_revenue = float(grouped["revenue"].sum())
    return [
        {
            "name": str(product),
            "category": str(category),
            "subcategory": str(subcategory),
            "revenue": round(float(row.revenue), 2),
            "share": _safe_share(float(row.revenue), total_revenue),
            "transactions": int(row.transactions),
            "units": int(row.units),
        }
        for (product, category, subcategory), row in grouped.head(25).iterrows()
    ]


def category_subcategory_contribution(frame: pd.DataFrame, top_categories: int = 5, top_subcategories: int = 4) -> list[dict[str, object]]:
    categories = category_rankings(frame)[:top_categories]
    payload: list[dict[str, object]] = []

    for category_item in categories:
        category_name = str(category_item["name"])
        category_frame = frame[frame["Category"] == category_name]
        total_revenue = float(category_frame["LineTotal"].sum())
        if category_frame.empty or total_revenue == 0:
            continue

        subcategory_grouped = (
            category_frame.groupby("Subcategory")
            .agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"), units=("RQty", "sum"))
            .sort_values("revenue", ascending=False)
        )

        top_rows = subcategory_grouped.head(top_subcategories)
        slices = [
            {
                "subcategory": str(subcategory),
                "revenue": round(float(row.revenue), 2),
                "share_of_category": _safe_share(float(row.revenue), total_revenue),
                "transactions": int(row.transactions),
                "units": int(row.units),
            }
            for subcategory, row in top_rows.iterrows()
        ]

        other_revenue = float(subcategory_grouped.iloc[top_subcategories:]["revenue"].sum()) if len(subcategory_grouped) > top_subcategories else 0.0
        other_transactions = int(subcategory_grouped.iloc[top_subcategories:]["transactions"].sum()) if len(subcategory_grouped) > top_subcategories else 0
        other_units = int(subcategory_grouped.iloc[top_subcategories:]["units"].sum()) if len(subcategory_grouped) > top_subcategories else 0
        if other_revenue > 0:
            slices.append(
                {
                    "subcategory": "Other",
                    "revenue": round(other_revenue, 2),
                    "share_of_category": _safe_share(other_revenue, total_revenue),
                    "transactions": other_transactions,
                    "units": other_units,
                }
            )

        lead = slices[0]
        payload.append(
            {
                "category": category_name,
                "total_revenue": round(total_revenue, 2),
                "share_of_total": _safe_share(total_revenue, float(frame["LineTotal"].sum())),
                "subcategory_count": int(subcategory_grouped.shape[0]),
                "lead_subcategory": str(lead["subcategory"]),
                "lead_share_of_category": float(lead["share_of_category"]),
                "subcategories": slices,
            }
        )

    return payload


def category_product_bridge(
    frame: pd.DataFrame,
    top_categories: int = 5,
    top_products: int = 8,
    global_product_cutoff: int = 15,
) -> list[dict[str, object]]:
    categories = category_rankings(frame)[:top_categories]
    global_products = product_rankings(frame)
    global_rank_lookup = {str(item["name"]): index + 1 for index, item in enumerate(global_products)}
    global_top_products = {
        str(item["name"])
        for index, item in enumerate(global_products)
        if index < global_product_cutoff
    }
    total_revenue = float(frame["LineTotal"].sum())
    payload: list[dict[str, object]] = []

    for category_item in categories:
        category_name = str(category_item["name"])
        category_frame = frame[frame["Category"] == category_name]
        category_revenue = float(category_frame["LineTotal"].sum())
        if category_frame.empty or category_revenue == 0:
            continue

        product_grouped = (
            category_frame.groupby(["Product", "Subcategory"])
            .agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"), units=("RQty", "sum"))
            .sort_values("revenue", ascending=False)
        )
        top_rows = product_grouped.head(top_products)
        driver_rows = []
        for product, subcategory in top_rows.index:
            row = top_rows.loc[(product, subcategory)]
            driver_rows.append(
                {
                    "product": str(product),
                    "subcategory": str(subcategory),
                    "revenue": round(float(row.revenue), 2),
                    "share_of_category": _safe_share(float(row.revenue), category_revenue),
                    "share_of_total": _safe_share(float(row.revenue), total_revenue),
                    "transactions": int(row.transactions),
                    "units": int(row.units),
                    "global_product_rank": int(global_rank_lookup.get(str(product), 0)),
                }
            )

        lead = driver_rows[0] if driver_rows else None
        payload.append(
            {
                "category": category_name,
                "total_revenue": round(category_revenue, 2),
                "share_of_total": _safe_share(category_revenue, total_revenue),
                "product_count": int(product_grouped.shape[0]),
                "top_product": str(lead["product"]) if lead else "N/A",
                "top_product_revenue": float(lead["revenue"]) if lead else 0.0,
                "top_product_share_of_category": float(lead["share_of_category"]) if lead else 0.0,
                "products_in_global_top": int(
                    sum(1 for product, _subcategory in product_grouped.index if str(product) in global_top_products),
                ),
                "drivers": driver_rows,
            }
        )

    return payload


def product_hierarchy_matrix(
    frame: pd.DataFrame,
    top_categories: int = 5,
    top_products_per_category: int = 8,
) -> list[dict[str, float | int | str]]:
    categories = [str(item["name"]) for item in category_rankings(frame)[:top_categories]]
    payload: list[dict[str, float | int | str]] = []

    for category_name in categories:
        category_frame = frame[frame["Category"] == category_name]
        category_revenue = float(category_frame["LineTotal"].sum())
        if category_frame.empty or category_revenue == 0:
            continue

        grouped = (
            category_frame.groupby(["Subcategory", "Product"])
            .agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"), units=("RQty", "sum"))
            .sort_values("revenue", ascending=False)
        )

        for rank, ((subcategory, product), row) in enumerate(grouped.head(top_products_per_category).iterrows(), start=1):
            payload.append(
                {
                    "category": category_name,
                    "subcategory": str(subcategory),
                    "product": str(product),
                    "revenue": round(float(row.revenue), 2),
                    "transactions": int(row.transactions),
                    "units": int(row.units),
                    "share_of_category": _safe_share(float(row.revenue), category_revenue),
                    "rank_within_category": rank,
                }
            )

    return payload


def _location_metrics(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    grouped = (
        frame.groupby("Location")
        .agg(
            revenue=("LineTotal", "sum"),
            transactions=("Transaction", "count"),
            machine_count=("Device ID", "nunique"),
        )
        .sort_values("revenue", ascending=False)
    )
    total_revenue = float(grouped["revenue"].sum())
    payload: list[dict[str, float | int | str]] = []
    for location, row in grouped.iterrows():
        location_frame = frame[frame["Location"] == location]
        top_category = (
            location_frame.groupby("Category")["LineTotal"].sum().sort_values(ascending=False).index[0]
            if not location_frame.empty
            else "N/A"
        )
        payload.append(
            {
                "name": str(location),
                "revenue": round(float(row.revenue), 2),
                "share": _safe_share(float(row.revenue), total_revenue),
                "transactions": int(row.transactions),
                "machine_count": int(row.machine_count),
                "average_ticket": round(float(row.revenue / row.transactions), 2) if row.transactions else 0.0,
                "top_category": str(top_category),
            }
        )
    return payload


def location_rankings(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    return _location_metrics(frame)[:15]


def location_map(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    payload: list[dict[str, float | int | str]] = []
    for item in _location_metrics(frame):
        latitude, longitude = _stable_coordinates(str(item["name"]))
        payload.append(
            {
                **item,
                "latitude": latitude,
                "longitude": longitude,
            }
        )
    return payload


def _recent_trend_pct(machine_frame: pd.DataFrame) -> float:
    if machine_frame.empty:
        return 0.0
    daily = machine_frame.groupby("DateOnly")["LineTotal"].sum().sort_index()
    if len(daily) < 2:
        return 0.0
    window = min(7, max(1, len(daily) // 2))
    recent = daily.iloc[-window:].mean()
    previous = daily.iloc[-window * 2 : -window].mean() if len(daily) > window else daily.iloc[:-1].mean()
    if pd.isna(previous) or previous == 0:
        return 0.0
    return round(float(((recent - previous) / previous) * 100), 2)


def _machine_metrics(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    grouped = (
        frame.groupby("Device ID")
        .agg(
            revenue=("LineTotal", "sum"),
            transactions=("Transaction", "count"),
            location=("Location", lambda s: s.mode().iat[0] if not s.mode().empty else s.iloc[0]),
        )
        .sort_values("revenue", ascending=False)
    )
    utilization_map = machine_utilization(frame)
    total_revenue = float(grouped["revenue"].sum())

    payload: list[dict[str, float | int | str]] = []
    for machine_id, row in grouped.iterrows():
        machine_frame = frame[frame["Device ID"] == machine_id]
        utilization = utilization_map.get(str(machine_id), 0.0)
        status = _status_from_utilization(utilization)
        payload.append(
            {
                "machine_id": str(machine_id),
                "location": str(row.location),
                "revenue": round(float(row.revenue), 2),
                "share": _safe_share(float(row.revenue), total_revenue),
                "transactions": int(row.transactions),
                "utilization": utilization,
                "status": status,
                "average_ticket": round(float(row.revenue / row.transactions), 2) if row.transactions else 0.0,
                "trend_pct": _recent_trend_pct(machine_frame),
            }
        )
    return payload


def machine_rankings(frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    return _machine_metrics(frame)[:20]


def category_location_matrix(frame: pd.DataFrame) -> list[dict[str, object]]:
    if frame.empty:
        return []
    top_locations = [item["name"] for item in location_rankings(frame)[:6]]
    top_categories = [item["name"] for item in category_rankings(frame)[:6]]
    matrix = []
    for location in top_locations:
        location_frame = frame[frame["Location"] == location]
        location_total = float(location_frame["LineTotal"].sum())
        categories = (
            location_frame.groupby("Category")["LineTotal"].sum().reindex(top_categories, fill_value=0.0)
        )
        matrix.append(
            {
                "location": location,
                "categories": [
                    {
                        "category": category,
                        "revenue": round(float(value), 2),
                        "share_of_location": _safe_share(float(value), location_total),
                    }
                    for category, value in categories.items()
                ],
            }
        )
    return matrix


def _forecast_machine_revenue(full_frame: pd.DataFrame, machine_id: str) -> tuple[float, int]:
    machine_frame = full_frame[full_frame["Device ID"] == machine_id].copy()
    if machine_frame.empty:
        return 0.0, 0
    recent_cutoff = machine_frame["TransDate"].max() - pd.Timedelta(days=14)
    recent = machine_frame[machine_frame["TransDate"] >= recent_cutoff]
    daily = recent.groupby("DateOnly").agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count"))
    if daily.empty:
        return 0.0, 0
    return round(float(daily["revenue"].mean()), 2), int(round(float(daily["transactions"].mean())))


def restock_priority(frame: pd.DataFrame, full_frame: pd.DataFrame) -> list[dict[str, float | int | str]]:
    machine_metrics = _machine_metrics(frame)
    network_average = float(frame.groupby("Device ID")["LineTotal"].sum().mean()) if not frame.empty else 0.0
    lowest_first = sorted(machine_metrics, key=lambda item: (item["utilization"], item["revenue"]))
    payload: list[dict[str, float | int | str]] = []
    for item in lowest_first[:10]:
        forecast_revenue, forecast_transactions = _forecast_machine_revenue(full_frame, str(item["machine_id"]))
        utilization = float(item["utilization"])
        trend_pct = float(item["trend_pct"])
        revenue_gap = max(network_average - float(item["revenue"]), 0.0)
        risk_score = round(max(0.0, (100 - utilization) * 0.48 + max(-trend_pct, 0) * 0.72 + forecast_transactions * 0.3 + revenue_gap / 60), 2)
        if utilization < 30:
            recommendation = "Immediate route visit: low utilization and sales decline."
        elif utilization < 50:
            recommendation = "Prioritize next route and refresh assortment mix."
        else:
            recommendation = "Monitor on planned route; risk is emerging, not critical."
        payload.append(
            {
                "machine_id": str(item["machine_id"]),
                "location": str(item["location"]),
                "status": str(item["status"]),
                "utilization": utilization,
                "revenue": float(item["revenue"]),
                "transactions": int(item["transactions"]),
                "forecast_revenue_24h": forecast_revenue,
                "risk_score": risk_score,
                "recommendation": recommendation,
            }
        )
    return payload


def forecast_summary(full_frame: pd.DataFrame) -> dict[str, float | int]:
    daily = full_frame.groupby("DateOnly").agg(revenue=("LineTotal", "sum"), transactions=("Transaction", "count")).sort_index()
    if daily.empty:
        return {"expected_revenue_next_24h": 0.0, "expected_revenue_next_7d": 0.0, "expected_transactions_next_24h": 0}
    recent = daily.tail(21)
    recent_mean = float(recent["revenue"].mean())
    if len(recent) >= 14:
        early = float(recent.head(len(recent) // 2)["revenue"].mean())
        late = float(recent.tail(len(recent) // 2)["revenue"].mean())
        trend_multiplier = 1.0 if early == 0 else max(0.92, min(1.12, late / early))
    else:
        trend_multiplier = 1.0
    next_day = recent_mean * trend_multiplier
    next_txns = int(round(float(recent["transactions"].mean()) * trend_multiplier))
    return {
        "expected_revenue_next_24h": round(next_day, 2),
        "expected_revenue_next_7d": round(next_day * 7, 2),
        "expected_transactions_next_24h": next_txns,
    }


def action_items(frame: pd.DataFrame, full_frame: pd.DataFrame) -> list[dict[str, str]]:
    actions: list[dict[str, str]] = []
    priority = restock_priority(frame, full_frame)
    locations = _location_metrics(frame)
    categories = category_rankings(frame)
    subcategories = subcategory_rankings(frame)
    products = product_rankings(frame)

    if priority:
        urgent = priority[0]
        actions.append(
            {
                "priority": "Critical",
                "title": f"Dispatch service to {urgent['location']}",
                "detail": f"Machine {urgent['machine_id']} has {urgent['utilization']:.1f}% utilization and a risk score of {urgent['risk_score']:.1f}.",
            }
        )

    if locations:
        weakest = locations[-1]
        network_avg = sum(float(item["revenue"]) for item in locations) / len(locations)
        actions.append(
            {
                "priority": "High",
                "title": f"Review performance at {weakest['name']}",
                "detail": f"Selected-period revenue is ${float(weakest['revenue']):,.0f}, below the network location average of ${network_avg:,.0f}.",
            }
        )

    if categories and subcategories and products:
        actions.append(
            {
                "priority": "Medium",
                "title": f"Double down on {subcategories[0]['name']}",
                "detail": f"It is the highest-grossing subcategory inside {categories[0]['name']}, led by {products[0]['name']}.",
            }
        )

    return actions


def recommendations(frame: pd.DataFrame, full_frame: pd.DataFrame) -> list[dict[str, str]]:
    return [{"title": item["title"], "detail": item["detail"]} for item in action_items(frame, full_frame)]


def kpis(frame: pd.DataFrame, operational_frame: pd.DataFrame | None = None) -> dict[str, object]:
    total_revenue = float(frame["LineTotal"].sum())
    total_transactions = int(frame["Transaction"].count())
    total_machines = int(frame["Device ID"].nunique())
    average_ticket = round(total_revenue / total_transactions, 2) if total_transactions else 0.0

    location_grouped = frame.groupby("Location")["LineTotal"].sum().sort_values(ascending=False)
    category_grouped = frame.groupby("Category")["LineTotal"].sum().sort_values(ascending=False)
    subcategory_grouped = frame.groupby("Subcategory")["LineTotal"].sum().sort_values(ascending=False)
    product_grouped = frame.groupby("Product")["LineTotal"].sum().sort_values(ascending=False)
    status = status_summary(operational_frame if operational_frame is not None else frame)

    return {
        "total_revenue": round(total_revenue, 2),
        "total_transactions": total_transactions,
        "total_machines": total_machines,
        "average_ticket": average_ticket,
        "top_location": top_kpi_item(location_grouped, "Highest profit place"),
        "top_category": top_kpi_item(category_grouped, "Highest profit category"),
        "top_subcategory": top_kpi_item(subcategory_grouped, "Highest profit subcategory"),
        "top_product": top_kpi_item(product_grouped, "Highest profit product"),
        "attention_machines": status["critical"],
    }
