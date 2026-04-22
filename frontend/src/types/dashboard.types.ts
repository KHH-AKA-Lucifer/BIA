export type DashboardPeriod = 'week' | 'month' | 'quarter' | 'year'
export type DashboardFilterKey = 'location' | 'category' | 'subcategory' | 'product' | 'machine_id' | 'weekday_index' | 'hour' | 'payment_type'

export interface DashboardFilters {
  location?: string
  category?: string
  subcategory?: string
  product?: string
  machine_id?: string
  weekday_index?: number
  hour?: number
  payment_type?: string
}

export type DashboardTab = 'executive' | 'products' | 'locations' | 'operations' | 'forecast'

export interface DateRangeSummary {
  start: string
  end: string
}

export interface KPIItem {
  name: string
  revenue: number
  share: number
  subtitle?: string | null
}

export interface DashboardKPIs {
  total_revenue: number
  total_transactions: number
  total_machines: number
  average_ticket: number
  top_location: KPIItem
  top_category: KPIItem
  top_subcategory: KPIItem
  top_product: KPIItem
  attention_machines: number
}

export interface RevenuePoint {
  label: string
  revenue: number
  transactions: number
}

export interface HourlyDemandPoint {
  hour: number
  label: string
  revenue: number
  transactions: number
}

export interface WeekdayDemandPoint {
  day_index: number
  label: string
  revenue: number
  transactions: number
}

export interface PaymentMixItem {
  name: string
  revenue: number
  transactions: number
  share: number
}

export interface StatusSummary {
  total: number
  healthy: number
  warning: number
  critical: number
}

export interface UtilizationBand {
  label: string
  count: number
}

export interface LocationRanking {
  name: string
  revenue: number
  share: number
  transactions: number
  machine_count: number
  average_ticket: number
  top_category: string
}

export interface LocationMapPoint extends LocationRanking {
  latitude: number
  longitude: number
}

export interface CategoryRanking {
  name: string
  revenue: number
  share: number
  transactions: number
  units: number
}

export interface SubcategoryRanking {
  name: string
  category: string
  revenue: number
  share: number
  transactions: number
  units: number
}

export interface ProductRanking {
  name: string
  category: string
  subcategory: string
  revenue: number
  share: number
  transactions: number
  units: number
}

export interface CategorySubcategorySlice {
  subcategory: string
  revenue: number
  share_of_category: number
  transactions: number
  units: number
}

export interface CategorySubcategoryContribution {
  category: string
  total_revenue: number
  share_of_total: number
  subcategory_count: number
  lead_subcategory: string
  lead_share_of_category: number
  subcategories: CategorySubcategorySlice[]
}

export interface CategoryProductDriver {
  product: string
  subcategory: string
  revenue: number
  share_of_category: number
  share_of_total: number
  transactions: number
  units: number
  global_product_rank: number
}

export interface CategoryProductBridge {
  category: string
  total_revenue: number
  share_of_total: number
  product_count: number
  top_product: string
  top_product_revenue: number
  top_product_share_of_category: number
  products_in_global_top: number
  drivers: CategoryProductDriver[]
}

export interface ProductHierarchyRow {
  category: string
  subcategory: string
  product: string
  revenue: number
  transactions: number
  units: number
  share_of_category: number
  rank_within_category: number
}

export interface MachineRanking {
  machine_id: string
  location: string
  revenue: number
  share: number
  transactions: number
  utilization: number
  status: 'healthy' | 'warning' | 'critical'
  average_ticket: number
  trend_pct: number
}

export interface CategoryLocationCell {
  category: string
  revenue: number
  share_of_location: number
}

export interface CategoryLocationRow {
  location: string
  categories: CategoryLocationCell[]
}

export interface RestockPriorityItem {
  machine_id: string
  location: string
  status: 'healthy' | 'warning' | 'critical'
  utilization: number
  revenue: number
  transactions: number
  forecast_revenue_24h: number
  risk_score: number
  recommendation: string
}

export interface ActionItem {
  priority: string
  title: string
  detail: string
}

export interface RecommendationItem {
  title: string
  detail: string
}

export interface ForecastSummary {
  expected_revenue_next_24h: number
  expected_revenue_next_7d: number
  expected_transactions_next_24h: number
}

export interface DashboardSummary {
  period: DashboardPeriod
  available_range: DateRangeSummary
  analysis_range: DateRangeSummary
  operational_range: DateRangeSummary
  kpis: DashboardKPIs
  revenue_series: RevenuePoint[]
  hourly_demand: HourlyDemandPoint[]
  weekday_demand: WeekdayDemandPoint[]
  payment_mix: PaymentMixItem[]
  status_summary: StatusSummary
  utilization_bands: UtilizationBand[]
  location_rankings: LocationRanking[]
  location_map: LocationMapPoint[]
  category_rankings: CategoryRanking[]
  subcategory_rankings: SubcategoryRanking[]
  product_rankings: ProductRanking[]
  category_subcategory_contribution: CategorySubcategoryContribution[]
  category_product_bridge: CategoryProductBridge[]
  product_hierarchy_matrix: ProductHierarchyRow[]
  machine_rankings: MachineRanking[]
  category_location_matrix: CategoryLocationRow[]
  restock_priority: RestockPriorityItem[]
  action_items: ActionItem[]
  recommendations: RecommendationItem[]
  forecast_summary: ForecastSummary
}
