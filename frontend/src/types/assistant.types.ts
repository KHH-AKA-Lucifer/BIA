export interface ModelCard {
  model_name: string
  model_type: string
  task_type: string
  scope: string
  target?: string | null
  metrics: Record<string, string | number | boolean | null>
  trained_at: string
}

export interface ChatRequest {
  message: string
  period: string
}

export interface ChatResponse {
  answer: string
  mode: string
  route: string
  model_name?: string | null
  model_type?: string | null
  confidence?: string | null
  data_scope?: string | null
  chart_hint?: string | null
  structured_data?: any
}
