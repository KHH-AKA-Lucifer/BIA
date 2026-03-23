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
  const iconMap = {
    revenue: <DollarSign className="h-8 w-8 text-blue-600" />,
    machines: <MapPin className="h-8 w-8 text-green-600" />,
    utilization: <Zap className="h-8 w-8 text-yellow-600" />,
    alerts: <AlertCircle className="h-8 w-8 text-red-600" />,
  }

  const trendIcon = {
    up: <TrendingUp className="h-4 w-4 text-green-600" />,
    down: <TrendingDown className="h-4 w-4 text-red-600" />,
    neutral: null,
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-500 text-sm font-medium mb-2">{title}</p>
          {loading ? (
            <div className="h-10 bg-gray-200 rounded animate-pulse w-24"></div>
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {unit && <span className="text-gray-600 text-sm">{unit}</span>}
            </div>
          )}
          {trend && trendValue && (
            <div className="flex items-center gap-1 mt-2">
              {trendIcon[trend as keyof typeof trendIcon]}
              <span className={`text-sm font-medium ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
                {trendValue}
              </span>
            </div>
          )}
        </div>
        <div className="flex-shrink-0 p-3 bg-gray-50 rounded-lg">{iconMap[icon]}</div>
      </div>
    </div>
  )
}

export default KPICard
