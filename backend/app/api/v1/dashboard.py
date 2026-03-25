from fastapi import APIRouter

from app.schemas.dashboard import DashboardSummaryResponse
from app.services.databoard_service import (
    all_locations_revenue,
    critical_alerts,
    filtered_dataframe,
    machine_map,
    machine_utilization,
    profit_trend,
    revenue_by_category,
    top_locations,
    Period,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def summary(period: Period = "week") -> DashboardSummaryResponse:
    frame = filtered_dataframe(period)

    return DashboardSummaryResponse(
        revenue_by_category=revenue_by_category(frame),
        profit_trend=profit_trend(period, frame),
        top_locations=top_locations(frame),
        all_locations_revenue=all_locations_revenue(frame),
        machine_utilization=machine_utilization(frame),
        alerts=critical_alerts(frame),
        map=machine_map(frame),
    )
