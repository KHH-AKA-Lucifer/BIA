import React from 'react'
import { TrendingUp, TrendingDown, AlertCircle, DollarSign, Zap, MapPin } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  unit?: string
  icon: 'revenue' | 'machines' | 'utilization' | 'alerts'
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  loading?: boolean
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  unit,
  icon,
  trend,
  trendValue,
  loading,
}) => {
  const [isHovered, setIsHovered] = React.useState(false)

  const iconConfig = {
    revenue: {
      icon: <DollarSign className="h-8 w-8" />,
      color: '#60a5fa',
      bgColor: 'rgba(96, 165, 250, 0.1)',
    },
    machines: {
      icon: <MapPin className="h-8 w-8" />,
      color: '#34d399',
      bgColor: 'rgba(52, 211, 153, 0.1)',
    },
    utilization: {
      icon: <Zap className="h-8 w-8" />,
      color: '#fbbf24',
      bgColor: 'rgba(251, 191, 36, 0.1)',
    },
    alerts: {
      icon: <AlertCircle className="h-8 w-8" />,
      color: '#f87171',
      bgColor: 'rgba(248, 113, 113, 0.1)',
    },
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    padding: '24px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    transform: isHovered ? 'translateY(-8px)' : 'translateY(0)',
  }

  const trendIcon = {
    up: <TrendingUp className="h-4 w-4" style={{ color: '#34d399' }} />,
    down: <TrendingDown className="h-4 w-4" style={{ color: '#f87171' }} />,
    neutral: null,
  }

  const iconsConfig = iconConfig[icon]

  return (
    <div
      style={{
        ...cardStyle,
        minHeight: '160px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', fontWeight: '500', marginBottom: '12px' }}>
            {title}
          </p>
          {loading ? (
            <div
              style={{
                height: '40px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                width: '96px',
                animation: 'pulse 2s infinite',
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <p style={{ fontSize: '32px', fontWeight: '700', color: '#fff', lineHeight: '1' }}>{value}</p>
              {unit && <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }}>{unit}</span>}
            </div>
          )}
          {trend && trendValue && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px' }}>
              {trendIcon[trend as keyof typeof trendIcon]}
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: trend === 'up' ? '#34d399' : trend === 'down' ? '#f87171' : 'rgba(255, 255, 255, 0.6)',
                }}
              >
                {trendValue}
              </span>
            </div>
          )}
        </div>
        <div
          style={{
            flexShrink: 0,
            padding: '12px',
            background: iconsConfig.bgColor,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconsConfig.color,
            transition: 'all 0.3s ease',
            transform: isHovered ? 'scale(1.1) rotate(5deg)' : 'scale(1)',
          }}
        >
          {iconsConfig.icon}
        </div>
      </div>
    </div>
  )
}

export default KPICard
