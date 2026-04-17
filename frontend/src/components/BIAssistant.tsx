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
  'Predict next 7 days revenue for Plainsview Market Synth 69',
  'Which machines are highest risk right now?',
  'What trained models are available?',
  'Cluster locations and explain the segments',
]
const launcherStyle: React.CSSProperties = {
  position: 'fixed',
  right: '24px',
  bottom: '24px',
  zIndex: 120,
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
  zIndex: 120,
  width: 'min(430px, calc(100vw - 24px))',
  maxWidth: 'calc(100vw - 24px)',
  background: '#FFFFFF',
  borderRadius: '28px',
  border: '1px solid #DCE5EF',
  boxShadow: '0 24px 70px rgba(15, 23, 42, 0.2)',
  overflow: 'hidden',
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
      content: 'Ask about forecasts, risk, clustering, or top performers. I use trained local models first and only fall back to external LLMs when needed.',
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
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)' }}>Trained models, guarded fallback, dashboard-aware answers</div>
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
                  <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '10px' }}>
                    {metaChip('Mode', item.meta.mode)}
                    {metaChip('Route', item.meta.route)}
                    {metaChip('Model', item.meta.model_name ?? null)}
                    {metaChip('Type', item.meta.model_type ?? null)}
                    {metaChip('Scope', item.meta.data_scope ?? null)}
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
              placeholder="Ask about revenue forecasts, risk, top products, or location segments..."
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
            These are the local models the assistant can use before any fallback call.
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
