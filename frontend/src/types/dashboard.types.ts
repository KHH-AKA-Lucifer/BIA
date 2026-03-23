export interface DashboardSummary {
  revenue_by_category: {
    labels: string[]
    values: number[]
  }
  weekly_profit: {
    labels: string[]
    values: number[]
  }
  top_locations: Record<string, number>
  machine_utilization: Record<string, number>
  alerts: string[]
  map: Array<{
    location: string
    lat: number
    lon: number
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
