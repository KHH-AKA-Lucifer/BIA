import React from 'react'
import {
  AlertTriangle,
  DollarSign,
  MapPinned,
  Package2,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

interface KPICardProps {
  eyebrow: string
  title: string
  value: string
  supporting: string
  icon: 'revenue' | 'location' | 'category' | 'product' | 'attention'
  tone?: 'neutral' | 'positive' | 'warning'
}

const ICONS = {
  revenue: DollarSign,
  location: MapPinned,
  category: ShoppingBag,
  product: Package2,
  attention: AlertTriangle,
}

const TONES = {
  neutral: {
    border: '#D7E0EA',
    iconBg: '#EEF4FF',
    iconFg: '#1D4ED8',
    supporting: '#475569',
  },
  positive: {
    border: '#CFE7D5',
    iconBg: '#EBF8EF',
    iconFg: '#15803D',
    supporting: '#166534',
  },
  warning: {
    border: '#F1D9B5',
    iconBg: '#FFF5E6',
    iconFg: '#B45309',
    supporting: '#9A3412',
  },
}

const KPICard: React.FC<KPICardProps> = ({ eyebrow, title, value, supporting, icon, tone = 'neutral' }) => {
  const Icon = ICONS[icon]
  const palette = TONES[tone]

  return (
    <article
      style={{
        background: '#FFFFFF',
        border: `1px solid ${palette.border}`,
        borderRadius: '18px',
        padding: '22px',
        minHeight: '180px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 10px 26px rgba(15, 23, 42, 0.06)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#64748B',
              marginBottom: '10px',
            }}
          >
            {eyebrow}
          </div>
          <h3
            style={{
              fontSize: '18px',
              lineHeight: 1.3,
              fontWeight: 700,
              color: '#0F172A',
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>
        <div
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '14px',
            background: palette.iconBg,
            color: palette.iconFg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={22} />
        </div>
      </div>

      <div>
        <div
          style={{
            fontSize: '34px',
            lineHeight: 1,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#0F172A',
            marginTop: '22px',
            marginBottom: '12px',
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontSize: '14px',
            lineHeight: 1.5,
            color: palette.supporting,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {tone === 'positive' ? <TrendingUp size={16} /> : tone === 'warning' ? <TrendingDown size={16} /> : null}
          <span>{supporting}</span>
        </div>
      </div>
    </article>
  )
}

export default KPICard
