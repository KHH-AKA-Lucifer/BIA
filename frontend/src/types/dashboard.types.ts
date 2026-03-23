export interface DashboardSummary {
  revenue_by_category: Record<string, number>
  weekly_profit: Record<string, number>
  top_locations: Record<string, number>
  machine_utilization: number
  alerts: string[]
  map: Array<{
    location: string
    latitude: number
    longitude: number
    revenue: number
  }>
}

export interface KPICard {
  title: string
  value: string | number
  unit?: string
  icon: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}
