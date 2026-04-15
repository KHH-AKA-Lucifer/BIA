from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import require_roles
from app.models.user import User
from app.schemas.assistant import ChatMessageRequest, ChatResponse, ModelCardResponse
from app.schemas.dashboard import DashboardSummaryResponse
from app.services.assistant_service import answer_chat
from app.services.databoard_service import (
    action_items,
    available_range,
    category_location_matrix,
    category_rankings,
    forecast_summary,
    hourly_demand,
    kpis,
    location_rankings,
    location_map,
    machine_rankings,
    filtered_dataframe,
    Period,
    payment_mix,
    recommendations,
    restock_priority,
    revenue_series,
    status_summary,
    subcategory_rankings,
    utilization_bands,
    weekday_demand,
    DF,
    date_range_payload,
    _period_bounds,
    product_rankings,
)
from app.services.predictive_service import get_model_registry, train_all_models

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def summary(period: Period = "week") -> DashboardSummaryResponse:
    frame = filtered_dataframe(period)
    available_start, available_end = available_range()
    filtered_start, filtered_end = _period_bounds(period)

    return DashboardSummaryResponse(
        period=period,
        available_range=date_range_payload(available_start, available_end),
        filtered_range=date_range_payload(filtered_start, filtered_end),
        kpis=kpis(frame),
        revenue_series=revenue_series(period, frame),
        hourly_demand=hourly_demand(frame),
        weekday_demand=weekday_demand(frame),
        payment_mix=payment_mix(frame),
        status_summary=status_summary(frame),
        utilization_bands=utilization_bands(frame),
        location_rankings=location_rankings(frame),
        location_map=location_map(frame),
        category_rankings=category_rankings(frame),
        subcategory_rankings=subcategory_rankings(frame),
        product_rankings=product_rankings(frame),
        machine_rankings=machine_rankings(frame),
        category_location_matrix=category_location_matrix(frame),
        restock_priority=restock_priority(frame, DF),
        action_items=action_items(frame, DF),
        recommendations=recommendations(frame, DF),
        forecast_summary=forecast_summary(DF),
    )


@router.get("/models", response_model=list[ModelCardResponse])
def list_models() -> list[ModelCardResponse]:
    return get_model_registry()


@router.post("/models/retrain", response_model=list[ModelCardResponse])
def retrain_models(
    current_user: User = Depends(require_roles("admin")),
) -> list[ModelCardResponse]:
    return train_all_models(force=True)


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatMessageRequest) -> ChatResponse:
    try:
        return ChatResponse(**answer_chat(payload.message, period=payload.period))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
