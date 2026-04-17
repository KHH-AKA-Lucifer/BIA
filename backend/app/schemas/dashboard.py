from pydantic import BaseModel


class DateRangeResponse(BaseModel):
    start: str
    end: str


class KPIItemResponse(BaseModel):
    name: str
    revenue: float
    share: float
    subtitle: str | None = None


class KPIResponse(BaseModel):
    total_revenue: float
    total_transactions: int
    total_machines: int
    average_ticket: float
    top_location: KPIItemResponse
    top_category: KPIItemResponse
    top_subcategory: KPIItemResponse
    top_product: KPIItemResponse
    attention_machines: int


class TimeSeriesPointResponse(BaseModel):
    label: str
    revenue: float
    transactions: int


class HourlyDemandPointResponse(BaseModel):
    hour: int
    label: str
    revenue: float
    transactions: int


class WeekdayDemandPointResponse(BaseModel):
    day_index: int
    label: str
    revenue: float
    transactions: int


class PaymentMixResponse(BaseModel):
    name: str
    revenue: float
    transactions: int
    share: float


class StatusSummaryResponse(BaseModel):
    total: int
    healthy: int
    warning: int
    critical: int


class UtilizationBandResponse(BaseModel):
    label: str
    count: int


class LocationRankingResponse(BaseModel):
    name: str
    revenue: float
    share: float
    transactions: int
    machine_count: int
    average_ticket: float
    top_category: str


class LocationMapPointResponse(LocationRankingResponse):
    latitude: float
    longitude: float


class CategoryRankingResponse(BaseModel):
    name: str
    revenue: float
    share: float
    transactions: int
    units: int


class SubcategoryRankingResponse(BaseModel):
    name: str
    category: str
    revenue: float
    share: float
    transactions: int
    units: int


class ProductRankingResponse(BaseModel):
    name: str
    category: str
    subcategory: str
    revenue: float
    share: float
    transactions: int
    units: int


class MachineRankingResponse(BaseModel):
    machine_id: str
    location: str
    revenue: float
    share: float
    transactions: int
    utilization: float
    status: str
    average_ticket: float
    trend_pct: float


class CategoryLocationCellResponse(BaseModel):
    category: str
    revenue: float
    share_of_location: float


class CategoryLocationRowResponse(BaseModel):
    location: str
    categories: list[CategoryLocationCellResponse]


class RestockPriorityResponse(BaseModel):
    machine_id: str
    location: str
    status: str
    utilization: float
    revenue: float
    transactions: int
    forecast_revenue_24h: float
    risk_score: float
    recommendation: str


class ActionItemResponse(BaseModel):
    priority: str
    title: str
    detail: str


class RecommendationResponse(BaseModel):
    title: str
    detail: str


class ForecastSummaryResponse(BaseModel):
    expected_revenue_next_24h: float
    expected_revenue_next_7d: float
    expected_transactions_next_24h: int


class DashboardSummaryResponse(BaseModel):
    period: str
    available_range: DateRangeResponse
    analysis_range: DateRangeResponse
    operational_range: DateRangeResponse
    kpis: KPIResponse
    revenue_series: list[TimeSeriesPointResponse]
    hourly_demand: list[HourlyDemandPointResponse]
    weekday_demand: list[WeekdayDemandPointResponse]
    payment_mix: list[PaymentMixResponse]
    status_summary: StatusSummaryResponse
    utilization_bands: list[UtilizationBandResponse]
    location_rankings: list[LocationRankingResponse]
    location_map: list[LocationMapPointResponse]
    category_rankings: list[CategoryRankingResponse]
    subcategory_rankings: list[SubcategoryRankingResponse]
    product_rankings: list[ProductRankingResponse]
    machine_rankings: list[MachineRankingResponse]
    category_location_matrix: list[CategoryLocationRowResponse]
    restock_priority: list[RestockPriorityResponse]
    action_items: list[ActionItemResponse]
    recommendations: list[RecommendationResponse]
    forecast_summary: ForecastSummaryResponse
