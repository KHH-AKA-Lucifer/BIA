import React from 'react'
import dashboardService from '../services/dashboard.service'
import type { DashboardPeriod } from '../types/dashboard.types'
import type { ChatResponse, ModelCard } from '../types/assistant.types'
import { Bot, SendHorizontal, Sparkles } from 'lucide-react'

interface BIAssistantProps {
  period: DashboardPeriod
}

interface ConversationItem {
  role: 'user' | 'assistant'
  content: string
  meta?: ChatResponse | null
}

const EXAMPLE_PROMPTS = [
  'Predict next 7 days revenue for Plainsview Market Synth 69',
  'Which machines are highest risk right now?',
  'What trained models are available?',
  'Cluster locations and explain the segments',
]

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #DCE5EF',
  padding: '24px',
  boxShadow: '0 14px 36px rgba(15, 23, 42, 0.07)',
}

const metaChip = (label: string, value: string | null | undefined) => {
  if (!value) return null
  return (
    <span
      key={`${label}-${value}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: '999px',
        background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        color: '#1D4ED8',
        fontSize: '12px',
        fontWeight: 700,
      }}
    >
      {label}: {value}
    </span>
  )
}

const BIAssistant: React.FC<BIAssistantProps> = ({ period }) => {
  const [models, setModels] = React.useState<ModelCard[]>([])
  const [loadingModels, setLoadingModels] = React.useState(true)
  const [message, setMessage] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [conversation, setConversation] = React.useState<ConversationItem[]>([
    {
      role: 'assistant',
      content: 'Ask a forecasting, risk, segmentation, or descriptive question. I will use local trained models first and only use an external LLM fallback if it is configured.',
      meta: null,
    },
  ])

  React.useEffect(() => {
    let ignore = false
    const loadModels = async () => {
      try {
        setLoadingModels(true)
        const registry = await dashboardService.getModels()
        if (!ignore) setModels(registry)
      } catch {
        if (!ignore) setModels([])
      } finally {
        if (!ignore) setLoadingModels(false)
      }
    }
    loadModels()
    return () => {
      ignore = true
    }
  }, [])

  const sendMessage = async (prompt: string) => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    setConversation((current) => [...current, { role: 'user', content: trimmed }])
    setMessage('')
    setSubmitting(true)
    try {
      const response = await dashboardService.chat({ message: trimmed, period })
      setConversation((current) => [...current, { role: 'assistant', content: response.answer, meta: response }])
    } catch (error: any) {
      setConversation((current) => [
        ...current,
        {
          role: 'assistant',
          content: error.response?.data?.detail || error.message || 'The assistant request failed.',
          meta: null,
        },
      ])
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.95fr)', gap: '20px' }}>
      <section style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '18px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '24px', lineHeight: 1.15, fontWeight: 900, color: '#0F172A', margin: 0 }}>BI Assistant</h2>
            <p style={{ fontSize: '14px', color: '#475569', margin: '8px 0 0 0', lineHeight: 1.6 }}>
              This chat routes to trained forecasting, classification, and clustering models before considering any external LLM fallback.
            </p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '14px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155' }}>
            <Sparkles size={16} color="#1D4ED8" />
            Period: <strong style={{ textTransform: 'capitalize' }}>{period}</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              style={{
                padding: '10px 12px',
                borderRadius: '14px',
                border: '1px solid #DCE5EF',
                background: '#FFFFFF',
                color: '#334155',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gap: '14px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px', marginBottom: '16px' }}>
          {conversation.map((item, index) => (
            <article
              key={`${item.role}-${index}`}
              style={{
                padding: '16px 18px',
                borderRadius: '18px',
                background: item.role === 'assistant' ? '#F8FAFC' : '#EFF6FF',
                border: `1px solid ${item.role === 'assistant' ? '#E2E8F0' : '#BFDBFE'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: item.role === 'assistant' ? '#DBEAFE' : '#CFFAFE',
                    color: '#1D4ED8',
                  }}
                >
                  {item.role === 'assistant' ? <Bot size={16} /> : <span style={{ fontWeight: 800 }}>You</span>}
                </div>
                <strong style={{ color: '#0F172A' }}>{item.role === 'assistant' ? 'Assistant' : 'You'}</strong>
              </div>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.65, color: '#334155' }}>{item.content}</p>
              {item.meta ? (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {metaChip('Mode', item.meta.mode)}
                  {metaChip('Route', item.meta.route)}
                  {metaChip('Model', item.meta.model_name ?? null)}
                  {metaChip('Type', item.meta.model_type ?? null)}
                  {metaChip('Scope', item.meta.data_scope ?? null)}
                  {metaChip('Confidence', item.meta.confidence ?? null)}
                </div>
              ) : null}
            </article>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'center' }}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder="Ask about forecasts, risk, top performers, or location segments..."
            style={{
              width: '100%',
              borderRadius: '16px',
              border: '1px solid #CBD5E1',
              padding: '14px 16px',
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <button
            onClick={() => sendMessage(message)}
            disabled={submitting}
            style={{
              alignSelf: 'stretch',
              minWidth: '64px',
              borderRadius: '16px',
              border: '1px solid #1D4ED8',
              background: '#1D4ED8',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 style={{ fontSize: '24px', lineHeight: 1.15, fontWeight: 900, color: '#0F172A', margin: 0 }}>Model Registry</h2>
        <p style={{ fontSize: '14px', color: '#475569', margin: '8px 0 16px 0', lineHeight: 1.6 }}>
          The assistant can only claim predictive modeling when a trained local model exists here.
        </p>

        {loadingModels ? (
          <div style={{ color: '#475569', fontSize: '14px' }}>Loading model metadata...</div>
        ) : (
          <div style={{ display: 'grid', gap: '12px', maxHeight: '640px', overflowY: 'auto', paddingRight: '4px' }}>
            {models.map((model) => (
              <article key={model.model_name} style={{ padding: '16px', borderRadius: '18px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', color: '#0F172A' }}>{model.model_name}</h3>
                    <div style={{ marginTop: '6px', fontSize: '13px', color: '#475569' }}>
                      {model.model_type} | {model.task_type} | {model.scope}
                    </div>
                  </div>
                  <div style={{ padding: '6px 10px', borderRadius: '999px', background: '#ECFDF3', color: '#166534', fontSize: '12px', fontWeight: 800 }}>
                    trained
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '6px', marginTop: '12px' }}>
                  {Object.entries(model.metrics || {}).map(([key, value]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '13px', color: '#334155' }}>
                      <span>{key}</span>
                      <strong>{String(value)}</strong>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#64748B' }}>
                  Trained at: {new Date(model.trained_at).toLocaleString()}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default BIAssistant
