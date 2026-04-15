from __future__ import annotations

from typing import Any

from app.services import databoard_service
from app.services.llm_service import generate_context_bound_answer
from app.services.predictive_service import (
    forecast_entity,
    get_location_segments,
    get_model_registry,
    predict_machine_risk,
)


def _normalize(text: str) -> str:
    return " ".join(text.casefold().split())


def _extract_best_match(message: str, candidates: list[str]) -> str | None:
    normalized_message = _normalize(message)
    for candidate in sorted(candidates, key=len, reverse=True):
        if _normalize(candidate) in normalized_message:
            return candidate
    return None


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


def _forecast_route(message: str) -> dict[str, Any]:
    candidates = _entity_candidates()
    horizon = 7 if any(token in _normalize(message) for token in ("7 day", "7-day", "week", "next 7")) else 1

    machine = _extract_best_match(message, candidates["machine"])
    if machine:
        payload = forecast_entity("machine", machine, horizon_days=horizon)
        return {
            "mode": "local_model",
            "route": "forecast_machine",
            "answer": f"The trained machine revenue forecaster predicts {machine} will generate {payload['next_7d_revenue'] if horizon > 1 else payload['next_day_revenue']:.2f} USD over the requested horizon.",
            "model_name": payload["model_name"],
            "model_type": payload["model_type"],
            "confidence": f"MAE {payload['metrics']['mae']} | RMSE {payload['metrics']['rmse']}",
            "data_scope": f"machine={machine}",
            "chart_hint": "line",
            "structured_data": payload,
        }

    location = _extract_best_match(message, candidates["location"])
    if location:
        payload = forecast_entity("location", location, horizon_days=horizon)
        return {
            "mode": "local_model",
            "route": "forecast_location",
            "answer": f"The trained location forecaster predicts {location} will generate {payload['next_7d_revenue'] if horizon > 1 else payload['next_day_revenue']:.2f} USD over the requested horizon.",
            "model_name": payload["model_name"],
            "model_type": payload["model_type"],
            "confidence": f"MAE {payload['metrics']['mae']} | RMSE {payload['metrics']['rmse']}",
            "data_scope": f"location={location}",
            "chart_hint": "line",
            "structured_data": payload,
        }

    category = _extract_best_match(message, candidates["category"])
    if category:
        payload = forecast_entity("category", category, horizon_days=horizon)
        return {
            "mode": "local_model",
            "route": "forecast_category",
            "answer": f"The trained category forecaster predicts {category} will generate {payload['next_7d_revenue'] if horizon > 1 else payload['next_day_revenue']:.2f} USD over the requested horizon.",
            "model_name": payload["model_name"],
            "model_type": payload["model_type"],
            "confidence": f"MAE {payload['metrics']['mae']} | RMSE {payload['metrics']['rmse']}",
            "data_scope": f"category={category}",
            "chart_hint": "line",
            "structured_data": payload,
        }

    payload = forecast_entity("network", horizon_days=horizon)
    return {
        "mode": "local_model",
        "route": "forecast_network",
        "answer": f"The trained network forecaster predicts {payload['next_7d_revenue'] if horizon > 1 else payload['next_day_revenue']:.2f} USD over the requested horizon.",
        "model_name": payload["model_name"],
        "model_type": payload["model_type"],
        "confidence": f"MAE {payload['metrics']['mae']} | RMSE {payload['metrics']['rmse']}",
        "data_scope": "network",
        "chart_hint": "line",
        "structured_data": payload,
    }


def _risk_route(message: str) -> dict[str, Any]:
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

    return {
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
    }


def _cluster_route() -> dict[str, Any]:
    payload = get_location_segments()
    first_segment = payload["segments"][0]
    return {
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
    }


def _analytics_route(message: str, period: str) -> dict[str, Any] | None:
    frame = databoard_service.filtered_dataframe(period)  # type: ignore[arg-type]
    lowered = _normalize(message)
    if any(token in lowered for token in ("top location", "highest profit place", "best location", "most profitable location")):
        top = databoard_service.location_rankings(frame)[0]
        return {
            "mode": "local_analytics",
            "route": "top_location",
            "answer": f"The highest-profit location in the selected period is {top['name']} with revenue of {top['revenue']:.2f} USD.",
            "model_name": None,
            "model_type": "descriptive analytics",
            "confidence": None,
            "data_scope": f"period={period}",
            "chart_hint": "bar",
            "structured_data": top,
        }
    if any(token in lowered for token in ("top category", "highest profit category", "best category")):
        top = databoard_service.category_rankings(frame)[0]
        return {
            "mode": "local_analytics",
            "route": "top_category",
            "answer": f"The highest-profit category in the selected period is {top['name']} with revenue of {top['revenue']:.2f} USD.",
            "model_name": None,
            "model_type": "descriptive analytics",
            "confidence": None,
            "data_scope": f"period={period}",
            "chart_hint": "bar",
            "structured_data": top,
        }
    if any(token in lowered for token in ("top product", "highest profit product", "best product")):
        top = databoard_service.product_rankings(frame)[0]
        return {
            "mode": "local_analytics",
            "route": "top_product",
            "answer": f"The highest-profit product in the selected period is {top['name']} with revenue of {top['revenue']:.2f} USD.",
            "model_name": None,
            "model_type": "descriptive analytics",
            "confidence": None,
            "data_scope": f"period={period}",
            "chart_hint": "bar",
            "structured_data": top,
        }
    return None


def answer_chat(message: str, period: str = "month") -> dict[str, Any]:
    lowered = _normalize(message)
    if not lowered:
        raise ValueError("Message is required")

    if any(token in lowered for token in ("model", "registry", "what models", "trained models")):
        registry = get_model_registry()
        return {
            "mode": "local_model",
            "route": "model_registry",
            "answer": f"There are {len(registry)} trained local models available, covering forecasting, classification, and clustering.",
            "model_name": "Model Registry",
            "model_type": "registry",
            "confidence": None,
            "data_scope": "all_models",
            "chart_hint": "table",
            "structured_data": registry,
        }

    if any(token in lowered for token in ("forecast", "predict", "prediction", "next day", "next week", "next 7")):
        return _forecast_route(message)

    if any(token in lowered for token in ("risk", "at risk", "restock", "service first", "critical machine")):
        return _risk_route(message)

    if any(token in lowered for token in ("cluster", "segment", "group similar locations")):
        return _cluster_route()

    analytics_answer = _analytics_route(message, period)
    if analytics_answer is not None:
        return analytics_answer

    fallback_context = {
        "summary": _summary_context(period),
        "models": get_model_registry(),
    }
    llm_answer = generate_context_bound_answer(message, fallback_context)
    if llm_answer is not None:
        return {
            "mode": "llm_fallback",
            "route": "llm_context_fallback",
            "answer": llm_answer["answer"],
            "model_name": llm_answer["model"],
            "model_type": f"{llm_answer['provider']} chat completion",
            "confidence": "Context-bound fallback only",
            "data_scope": f"period={period}",
            "chart_hint": None,
            "structured_data": None,
        }

    return {
        "mode": "unsupported",
        "route": "no_route",
        "answer": (
            "I could not route that request to a trained local model or deterministic analytics function, "
            "and no fallback LLM provider is configured."
        ),
        "model_name": None,
        "model_type": None,
        "confidence": None,
        "data_scope": f"period={period}",
        "chart_hint": None,
        "structured_data": None,
    }
