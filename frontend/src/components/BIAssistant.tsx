import React from 'react'
import dashboardService from '../services/dashboard.service'
import type { DashboardPeriod } from '../types/dashboard.types'
import type { ChatResponse, ModelCard } from '../types/assistant.types'
import { Bot, ChevronDown, MessageSquareText, SendHorizontal, Wrench, X } from 'lucide-react'

interface BIAssistantProps {
  period: DashboardPeriod
}

interface ConversationItem {
  role: 'user' | 'assistant'
  content: string
  meta?: ChatResponse | null
}

type AssistantView = 'chat' | 'models'

const EXAMPLE_PROMPTS = [
  'What is the best selling product of last 7 days?',
  'What is the best performing location in last 24 hours?',
  'Which machines are highest risk right now?',
  'Predict next 7 days revenue for Plainsview Market Synth 69',
]
const launcherStyle: React.CSSProperties = {
  position: 'fixed',
  right: '24px',
  bottom: '24px',
  zIndex: 950,
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
  padding: '16px 18px',
  borderRadius: '999px',
  border: '1px solid #1D4ED8',
  background: 'linear-gradient(135deg, #1D4ED8 0%, #0F766E 100%)',
  color: '#FFFFFF',
  boxShadow: '0 20px 50px rgba(15, 23, 42, 0.24)',
  cursor: 'pointer',
}

const shellStyle: React.CSSProperties = {
  position: 'fixed',
  right: '24px',
  bottom: '24px',
  zIndex: 950,
  width: 'min(430px, calc(100vw - 24px))',
  maxWidth: 'calc(100vw - 24px)',
  background: '#FFFFFF',
  borderRadius: '28px',
  border: '1px solid #DCE5EF',
  boxShadow: '0 24px 70px rgba(15, 23, 42, 0.2)',
  overflow: 'hidden',
}

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return value.toLocaleString()
    return value.toFixed(2)
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

const summarizePayload = (payload: unknown): Array<[string, string]> => {
  if (!payload) return []
  if (Array.isArray(payload)) {
    const firstRow = payload[0]
    if (firstRow && typeof firstRow === 'object') {
      return Object.entries(firstRow as Record<string, unknown>)
        .slice(0, 4)
        .map(([key, value]) => [key.replace(/_/g, ' '), formatValue(value)])
    }
    return [['items', `${payload.length}`]]
  }
  if (typeof payload === 'object') {
    return Object.entries(payload as Record<string, unknown>)
      .filter(([, value]) => typeof value !== 'object')
      .slice(0, 6)
      .map(([key, value]) => [key.replace(/_/g, ' '), formatValue(value)])
  }
  return [['value', formatValue(payload)]]
}

const metaChip = (label: string, value: string | null | undefined) => {
  if (!value) return null
  return (
    <span
      key={`${label}-${value}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 9px',
        borderRadius: '999px',
        background: '#EFF6FF',
        border: '1px solid #BFDBFE',
        color: '#1D4ED8',
        fontSize: '11px',
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
  const [open, setOpen] = React.useState(false)
  const [view, setView] = React.useState<AssistantView>('chat')
  const [conversation, setConversation] = React.useState<ConversationItem[]>([
    {
      role: 'assistant',
      content: 'Ask for top performers, product mix, machine risk, or a forecast. Each answer is grounded in the selected dashboard period and now shows the exact data slice used.',
      meta: null,
    },
  ])
  const conversationEndRef = React.useRef<HTMLDivElement | null>(null)

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

  React.useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [conversation, open, view])

  const sendMessage = async (prompt: string) => {
    const trimmed = prompt.trim()
    if (!trimmed) return
    setOpen(true)
    setView('chat')
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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={launcherStyle}>
        <Bot size={20} />
        <span style={{ fontSize: '14px', fontWeight: 800 }}>Ask BI Assistant</span>
      </button>
    )
  }

  return (
    <div style={shellStyle}>
      <div
        style={{
          padding: '16px 18px',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E3A8A 55%, #0F766E 100%)',
          color: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.16)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={20} />
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 900 }}>BI Assistant</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)' }}>Scoped answers, evidence slice, and model-backed predictions</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.12)',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronDown size={16} />
            </button>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.12)',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setView('chat')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.18)',
              background: view === 'chat' ? '#FFFFFF' : 'rgba(255,255,255,0.12)',
              color: view === 'chat' ? '#0F172A' : '#FFFFFF',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <MessageSquareText size={15} />
            Chat
          </button>
          <button
            onClick={() => setView('models')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: '999px',
              border: '1px solid rgba(255,255,255,0.18)',
              background: view === 'models' ? '#FFFFFF' : 'rgba(255,255,255,0.12)',
              color: view === 'models' ? '#0F172A' : '#FFFFFF',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Wrench size={15} />
            Models
          </button>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 12px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.12)',
              color: '#FFFFFF',
              fontSize: '12px',
              fontWeight: 800,
              textTransform: 'capitalize',
            }}
          >
            Dashboard period: {period}
          </div>
        </div>
      </div>

      {view === 'chat' ? (
        <div style={{ padding: '16px', background: '#F8FBFF' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                style={{
                  padding: '9px 11px',
                  borderRadius: '12px',
                  border: '1px solid #DCE5EF',
                  background: '#FFFFFF',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gap: '12px',
              height: '360px',
              overflowY: 'auto',
              padding: '2px 4px 2px 0',
              marginBottom: '14px',
            }}
          >
            {conversation.map((item, index) => (
              <article
                key={`${item.role}-${index}`}
                style={{
                  justifySelf: item.role === 'assistant' ? 'start' : 'end',
                  maxWidth: '88%',
                  padding: '14px 16px',
                  borderRadius: item.role === 'assistant' ? '18px 18px 18px 6px' : '18px 18px 6px 18px',
                  background: item.role === 'assistant' ? '#FFFFFF' : 'linear-gradient(135deg, #DBEAFE 0%, #CFFAFE 100%)',
                  border: `1px solid ${item.role === 'assistant' ? '#E2E8F0' : '#BFDBFE'}`,
                  boxShadow: '0 8px 20px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: item.role === 'assistant' ? '#DBEAFE' : '#FFFFFF',
                      color: '#1D4ED8',
                    }}
                  >
                    {item.role === 'assistant' ? <Bot size={14} /> : <span style={{ fontWeight: 900, fontSize: '12px' }}>You</span>}
                  </div>
                  <strong style={{ color: '#0F172A', fontSize: '13px' }}>{item.role === 'assistant' ? 'Assistant' : 'You'}</strong>
                </div>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: '#334155', whiteSpace: 'pre-wrap' }}>{item.content}</p>
                {item.meta ? (
                  <div style={{ display: 'grid', gap: '10px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                      {metaChip('Mode', item.meta.mode)}
                      {metaChip('Route', item.meta.route)}
                      {metaChip('Model', item.meta.model_name ?? null)}
                      {metaChip('Scope', item.meta.request_context?.scope_label ?? item.meta.data_scope ?? null)}
                      {metaChip('Confidence', item.meta.confidence ?? null)}
                    </div>

                    {item.meta.request_context ? (
                      <div style={{ borderRadius: '14px', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 13px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Data Scope
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginTop: '10px' }}>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>Window</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                              {item.meta.request_context.start} to {item.meta.request_context.end}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>Grain</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', textTransform: 'capitalize' }}>
                              {item.meta.request_context.time_grain}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>Rows</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{item.meta.request_context.row_count.toLocaleString()}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>Strategy</div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                              {item.meta.request_context.route_strategy.replace(/_/g, ' ')}
                            </div>
                          </div>
                        </div>

                        {item.meta.request_context.columns.length ? (
                          <div style={{ marginTop: '10px' }}>
                            <div style={{ fontSize: '11px', color: '#64748B', textTransform: 'uppercase' }}>Columns used</div>
                            <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                              {item.meta.request_context.columns.join(' • ')}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {summarizePayload(item.meta.evidence?.answer_payload ?? item.meta.structured_data).length ? (
                      <div style={{ borderRadius: '14px', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '12px 13px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Answer Facts
                        </div>
                        <div style={{ display: 'grid', gap: '6px', marginTop: '10px' }}>
                          {summarizePayload(item.meta.evidence?.answer_payload ?? item.meta.structured_data).map(([key, value]) => (
                            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px' }}>
                              <span style={{ color: '#475569', textTransform: 'capitalize' }}>{key}</span>
                              <strong style={{ color: '#0F172A', textAlign: 'right' }}>{value}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {item.meta.evidence?.preview_rows?.length ? (
                      <div style={{ borderRadius: '14px', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '12px 13px', overflowX: 'auto' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                          Evidence Slice
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr>
                              {Object.keys(item.meta.evidence.preview_rows[0]).map((column) => (
                                <th key={column} style={{ padding: '0 8px 8px 0', textAlign: 'left', color: '#64748B', fontWeight: 800 }}>
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {item.meta.evidence.preview_rows.slice(0, 4).map((row, rowIndex) => (
                              <tr key={rowIndex} style={{ borderTop: '1px solid #EEF2F7' }}>
                                {Object.entries(row).map(([column, value]) => (
                                  <td key={`${rowIndex}-${column}`} style={{ padding: '8px 8px 8px 0', color: '#334155', verticalAlign: 'top' }}>
                                    {formatValue(value)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
            <div ref={conversationEndRef} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '10px', alignItems: 'end' }}>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              placeholder="Ask about top products, top locations, machine risk, demand, or forecasts..."
              style={{
                width: '100%',
                borderRadius: '18px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                padding: '14px 16px',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                fontSize: '14px',
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage(message)
                }
              }}
            />
            <button
              onClick={() => sendMessage(message)}
              disabled={submitting}
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '18px',
                border: '1px solid #1D4ED8',
                background: submitting ? '#93C5FD' : '#1D4ED8',
                color: '#FFFFFF',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 12px 24px rgba(29, 78, 216, 0.22)',
              }}
            >
              <SendHorizontal size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '16px', background: '#F8FBFF' }}>
          <div style={{ fontSize: '13px', color: '#475569', marginBottom: '12px', lineHeight: 1.6 }}>
            These are the trained local models available to the assistant before any external fallback.
          </div>
          {loadingModels ? (
            <div style={{ color: '#475569', fontSize: '14px' }}>Loading model metadata...</div>
          ) : (
            <div style={{ display: 'grid', gap: '10px', maxHeight: '430px', overflowY: 'auto', paddingRight: '4px' }}>
              {models.map((model) => (
                <article key={model.model_name} style={{ padding: '14px', borderRadius: '18px', background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px', color: '#0F172A' }}>{model.model_name}</h3>
                      <div style={{ marginTop: '4px', fontSize: '12px', color: '#475569' }}>
                        {model.model_type} | {model.task_type} | {model.scope}
                      </div>
                    </div>
                    <div style={{ padding: '5px 9px', borderRadius: '999px', background: '#ECFDF3', color: '#166534', fontSize: '11px', fontWeight: 800 }}>
                      trained
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: '5px', marginTop: '10px' }}>
                    {Object.entries(model.metrics || {}).slice(0, 4).map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', fontSize: '12px', color: '#334155' }}>
                        <span>{key}</span>
                        <strong>{String(value)}</strong>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BIAssistant
