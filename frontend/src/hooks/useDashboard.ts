import { useEffect, useState } from 'react'
import { DashboardSummary } from '../types/dashboard.types'
import dashboardService from '../services/dashboard.service'

interface UseDashboardReturn {
  data: DashboardSummary | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export const useDashboard = (): UseDashboardReturn => {
  const [data, setData] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const summary = await dashboardService.getSummary()
      setData(summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const refresh = async () => {
    await fetchData()
  }

  return { data, loading, error, refresh }
}
