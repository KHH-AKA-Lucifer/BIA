import apiClient from './api.client'
import { DashboardSummary } from '../types/dashboard.types'

export type DashboardPeriod = 'week' | 'month' | 'quarter'

class DashboardService {
  async getSummary(period: DashboardPeriod): Promise<DashboardSummary> {
    const response = await apiClient.get<DashboardSummary>('/dashboard/summary', {
      params: { period },
    })
    return response.data
  }
}

export default new DashboardService()
