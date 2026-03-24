from fastapi import APIRouter

from app.schemas.dashboard import DashboardSummaryResponse
from app.services.databoard_service import (
    critical_alerts,
    machine_map,
    machine_utilization,
    revenue_by_category,
    top_locations,
    weekly_profit,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary", response_model=DashboardSummaryResponse)
def summary() -> DashboardSummaryResponse:
    return DashboardSummaryResponse(
        revenue_by_category=revenue_by_category(),
        weekly_profit=weekly_profit(),
        top_locations=top_locations(),
        machine_utilization=machine_utilization(),
        alerts=critical_alerts(),
        map=machine_map(),
    )
