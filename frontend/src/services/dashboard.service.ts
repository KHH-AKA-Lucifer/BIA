import apiClient from './api.client'
import { DashboardSummary } from '../types/dashboard.types'

class DashboardService {
  async getSummary(): Promise<DashboardSummary> {
    const response = await apiClient.get<DashboardSummary>('/dashboard/summary')
    return response.data
  }
}

export default new DashboardService()
