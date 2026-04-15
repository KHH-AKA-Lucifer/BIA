import React from 'react'
import {
  X,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Zap,
  Activity,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ─── Types ───────────────────────────────────────────────────────────────────
interface MachineDetailPanelProps {
  machine: { id: string; utilization: number }
  alerts: string[]
  trendData: { day: string; revenue: number }[]
  onClose: () => void
  cardStyle: React.CSSProperties
}

// ─── Helpers (duplicated locally so panel is self-contained) ─────────────────
const getStatusColor = (u: number) => (u >= 70 ? '#22c55e' : u >= 40 ? '#eab308' : '#ef4444')
const getStatusLabel = (u: number) => (u >= 70 ? 'Healthy' : u >= 40 ? 'Warning' : 'Needs attention')
const getStatusBg = (u: number) =>
  u >= 70 ? 'rgba(34,197,94,0.12)' : u >= 40 ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.12)'
const getStatusBorder = (u: number) =>
  u >= 70 ? 'rgba(34,197,94,0.25)' : u >= 40 ? 'rgba(234,179,8,0.25)' : 'rgba(239,68,68,0.25)'

// ─── Component ────────────────────────────────────────────────────────────────
const MachineDetailPanel: React.FC<MachineDetailPanelProps> = ({
  machine,
  alerts,
  trendData,
  onClose,
  cardStyle,
}) => {
  const { id, utilization } = machine
  const color = getStatusColor(utilization)
  const statusLabel = getStatusLabel(utilization)

  const totalRevenue = trendData.reduce((s, d) => s + d.revenue, 0)
  const avgRevenue = totalRevenue / (trendData.length || 1)
  const lastRevenue = trendData[trendData.length - 1]?.revenue ?? 0
  const prevRevenue = trendData[trendData.length - 2]?.revenue ?? 0
  const revDelta = lastRevenue - prevRevenue
  const revDeltaPct = prevRevenue ? ((revDelta / prevRevenue) * 100).toFixed(1) : '0'

  const tooltipStyle = {
    backgroundColor: 'rgba(10,15,30,0.97)',
    border: '1px solid rgba(96,165,250,0.25)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '12px',
  }

  const sectionHeading: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    margin: '0 0 12px 0',
  }

  const statBox: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    padding: '16px 18px',
    flex: 1,
  }

  return (
    <div
      style={{
        ...cardStyle,
        padding: '20px',
        position: 'sticky',
        top: '130px',
        maxHeight: 'calc(100vh - 150px)',
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        animation: 'slideIn 0.2s ease',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff', letterSpacing: '-0.3px' }}>
            {id}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px',
            marginTop: '5px', padding: '3px 10px', borderRadius: '20px',
            background: getStatusBg(utilization), border: `1px solid ${getStatusBorder(utilization)}`,
          }}>
            {utilization >= 70
              ? <CheckCircle style={{ width: '11px', height: '11px', color }} />
              : <AlertCircle style={{ width: '11px', height: '11px', color }} />}
            <span style={{ fontSize: '11px', fontWeight: '700', color }}>{statusLabel}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: '7px',
            padding: '7px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
            display: 'flex', alignItems: 'center',
          }}
        >
          <X style={{ width: '14px', height: '14px' }} />
        </button>
      </div>

      {/* Activity gauge */}
      <div style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <p style={{ ...sectionHeading, margin: 0 }}>Activity level</p>
          <span style={{ fontSize: '24px', fontWeight: '800', color, lineHeight: 1 }}>
            {utilization.toFixed(0)}%
          </span>
        </div>
        <div style={{ height: '10px', background: 'rgba(255,255,255,0.07)', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{
            width: `${utilization}%`, height: '100%', borderRadius: '5px',
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
          <span style={{ fontSize: '10px', color: '#ef4444' }}>Critical 0%</span>
          <span style={{ fontSize: '10px', color: '#eab308' }}>Warning 40%</span>
          <span style={{ fontSize: '10px', color: '#22c55e' }}>Healthy 70%+</span>
        </div>
      </div>

      {/* Revenue stats row */}
      <p style={sectionHeading}>Revenue this period</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        <div style={statBox}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Total</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#60a5fa' }}>${totalRevenue.toFixed(1)}K</div>
        </div>
        <div style={statBox}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>Daily avg</div>
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#a78bfa' }}>${avgRevenue.toFixed(1)}K</div>
        </div>
        <div style={statBox}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>vs yesterday</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {revDelta >= 0
              ? <TrendingUp style={{ width: '13px', height: '13px', color: '#22c55e' }} />
              : <TrendingDown style={{ width: '13px', height: '13px', color: '#ef4444' }} />}
            <span style={{ fontSize: '14px', fontWeight: '700', color: revDelta >= 0 ? '#22c55e' : '#ef4444' }}>
              {revDelta >= 0 ? '+' : ''}{revDeltaPct}%
            </span>
          </div>
        </div>
      </div>

      {/* Mini trend chart */}
      <p style={sectionHeading}>Revenue trend</p>
      <div style={{ marginBottom: '18px' }}>
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={trendData} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="day" stroke="rgba(255,255,255,0.25)" style={{ fontSize: '10px' }} />
            <YAxis stroke="rgba(255,255,255,0.25)" style={{ fontSize: '10px' }} tickFormatter={v => `$${v}K`} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`$${Number(v).toFixed(1)}K`, 'Revenue']} />
            <Line type="monotone" dataKey="revenue" stroke={color} strokeWidth={2.5}
              dot={{ fill: color, r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recommendation box */}
      <div style={{
        padding: '12px 14px', borderRadius: '10px', marginBottom: '16px',
        background: getStatusBg(utilization), border: `1px solid ${getStatusBorder(utilization)}`,
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          {utilization >= 70
            ? <Activity style={{ width: '14px', height: '14px', color, flexShrink: 0, marginTop: '1px' }} />
            : <Zap style={{ width: '14px', height: '14px', color, flexShrink: 0, marginTop: '1px' }} />}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color, marginBottom: '4px' }}>
              {utilization >= 70 ? 'Recommended action: Monitor' : utilization >= 40 ? 'Recommended action: Schedule check' : 'Recommended action: Restock now'}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              {utilization >= 70
                ? 'This machine is performing well. No immediate action required.'
                : utilization >= 40
                ? 'Activity is below the healthy threshold. Schedule a restock and inspection within 24–48 hours.'
                : 'This machine needs immediate attention. Restocking should be prioritised today to prevent revenue loss.'}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts for this machine */}
      {alerts.length > 0 && (
        <div>
          <p style={sectionHeading}>Active alerts for this machine</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {alerts.map((a, i) => (
              <div
                key={i}
                style={{
                  padding: '9px 12px', borderRadius: '8px', fontSize: '12px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                  color: 'rgba(255,255,255,0.8)', lineHeight: 1.4,
                }}
              >
                <AlertCircle style={{ width: '12px', height: '12px', color: '#ef4444', display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                {a.replace(id, '').trim()}
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center',
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
        }}>
          <CheckCircle style={{ width: '13px', height: '13px', color: '#22c55e' }} />
          <span style={{ fontSize: '11px', color: '#86efac' }}>No active alerts for this machine</span>
        </div>
      )}
    </div>
  )
}

export default MachineDetailPanel
