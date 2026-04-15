import { useEffect, useState } from 'react'
import { DashboardPeriod, DashboardSummary } from '../types/dashboard.types'
import dashboardService from '../services/dashboard.service'

interface UseDashboardReturn {
  data: DashboardSummary | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export const useDashboard = (period: DashboardPeriod): UseDashboardReturn => {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const summary = await dashboardService.getSummary(period)
      setData(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [period])

  const refresh = async () => {
    await fetchData()
  }

  return { data, loading, error, refresh }
}
