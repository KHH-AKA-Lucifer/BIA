from pydantic import BaseModel


class ChartDataResponse(BaseModel):
    labels: list[str]
    values: list[float]


class MachineLocationResponse(BaseModel):
    location: str
    lat: float
    lon: float


class DashboardSummaryResponse(BaseModel):
    revenue_by_category: ChartDataResponse
    weekly_profit: ChartDataResponse
    top_locations: dict[str, float]
    machine_utilization: dict[str, float]
    alerts: list[str]
    map: list[MachineLocationResponse]
