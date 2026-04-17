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
    operational_dataframe,
    operational_bounds,
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
    analysis_frame = filtered_dataframe(period)
    operations_frame = operational_dataframe()
    available_start, available_end = available_range()
    analysis_start, analysis_end = _period_bounds(period)
    operational_start, operational_end = operational_bounds()

    return DashboardSummaryResponse(
        period=period,
        available_range=date_range_payload(available_start, available_end),
        analysis_range=date_range_payload(analysis_start, analysis_end),
        operational_range=date_range_payload(operational_start, operational_end),
        kpis=kpis(analysis_frame, operational_frame=operations_frame),
        revenue_series=revenue_series(period, analysis_frame),
        hourly_demand=hourly_demand(analysis_frame),
        weekday_demand=weekday_demand(analysis_frame),
        payment_mix=payment_mix(analysis_frame),
        status_summary=status_summary(operations_frame),
        utilization_bands=utilization_bands(operations_frame),
        location_rankings=location_rankings(analysis_frame),
        location_map=location_map(analysis_frame),
        category_rankings=category_rankings(analysis_frame),
        subcategory_rankings=subcategory_rankings(analysis_frame),
        product_rankings=product_rankings(analysis_frame),
        machine_rankings=machine_rankings(operations_frame),
        category_location_matrix=category_location_matrix(analysis_frame),
        restock_priority=restock_priority(operations_frame, DF),
        action_items=action_items(operations_frame, DF),
        recommendations=recommendations(operations_frame, DF),
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
