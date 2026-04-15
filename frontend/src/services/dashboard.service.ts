import apiClient from './api.client'
import { DashboardPeriod, DashboardSummary } from '../types/dashboard.types'
import { ChatRequest, ChatResponse, ModelCard } from '../types/assistant.types'

class DashboardService {
  async getSummary(period: DashboardPeriod): Promise<DashboardSummary> {
    const response = await apiClient.get<DashboardSummary>('/dashboard/summary', {
      params: { period },
    })
    return response.data
  }

  async getModels(): Promise<ModelCard[]> {
    const response = await apiClient.get<ModelCard[]>('/dashboard/models')
    return response.data
  }

  async chat(payload: ChatRequest): Promise<ChatResponse> {
    const response = await apiClient.post<ChatResponse>('/dashboard/chat', payload)
    return response.data
  }
}

export default new DashboardService()
