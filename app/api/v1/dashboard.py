from fastapi import APIRouter, Depends, HTTPException, status
from app.services.databoard_service import revenue_by_category, weekly_profit, top_locations, all_locations_revenue, machine_utilization, critical_alerts, machine_map

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

@router.get("/summary")
def summary():
    return {
        "revenue_by_category": revenue_by_category(),
        "weekly_profit": weekly_profit(),
        "top_locations": top_locations(),
        "all_locations_revenue": all_locations_revenue(),
        "machine_utilization": machine_utilization(),
        "alerts": critical_alerts(),
        "map": machine_map()
    }