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
    category_product_bridge,
    category_rankings,
    category_subcategory_contribution,
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
    product_hierarchy_matrix,
    SummaryFilters,
)
from app.services.predictive_service import get_model_registry, train_all_models

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def summary(
    period: Period = "week",
    location: str | None = None,
    category: str | None = None,
    subcategory: str | None = None,
    product: str | None = None,
    machine_id: str | None = None,
    weekday_index: int | None = None,
    hour: int | None = None,
    payment_type: str | None = None,
) -> DashboardSummaryResponse:
    filters: SummaryFilters = {}
    if location:
        filters["location"] = location
    if category:
        filters["category"] = category
    if subcategory:
        filters["subcategory"] = subcategory
    if product:
        filters["product"] = product
    if machine_id:
        filters["machine_id"] = machine_id
    if weekday_index is not None:
        filters["weekday_index"] = weekday_index
    if hour is not None:
        filters["hour"] = hour
    if payment_type:
        filters["payment_type"] = payment_type

    analysis_frame = filtered_dataframe(period, filters=filters)
    operations_frame = operational_dataframe(filters=filters)
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
        category_subcategory_contribution=category_subcategory_contribution(analysis_frame),
        category_product_bridge=category_product_bridge(analysis_frame),
        product_hierarchy_matrix=product_hierarchy_matrix(analysis_frame),
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
