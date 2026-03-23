import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../hooks/useDashboard'
import KPICard from '../components/KPICard'
import {
  LogOut,
  RefreshCw,
  AlertCircle,
  MapPin,
  BarChart3,
  Zap,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Treemap,
} from 'recharts'

type TabType = 'executive' | 'machines' | 'geographic' | 'locations' | 'analytics'

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth()
  const { data, loading, error, refresh } = useDashboard()

  const [activeTab, setActiveTab] = React.useState<TabType>('executive')
  const [dateRange, setDateRange] = React.useState<'week' | 'month' | 'quarter'>('week')
  const [selectedLocation, setSelectedLocation] = React.useState<string | null>(null)
  const [machineStatus, setMachineStatus] = React.useState<'all' | 'healthy' | 'warning' | 'critical'>('all')

  // Calculate metrics
  const totalRevenue = data
    ? data.revenue_by_category.values.reduce((sum: number, val: number) => sum + val, 0)
    : 0

  const machineCount = data ? Object.keys(data.machine_utilization).length : 0
  const avgMachineUtilization = data
    ? Object.values(data.machine_utilization).reduce((sum: number, val: number) => sum + val, 0) /
      Math.max(Object.keys(data.machine_utilization).length, 1)
    : 0

  const alertCount = data ? data.alerts.length : 0
  const machines = data ? Object.entries(data.machine_utilization).map(([id, util]) => ({ id, utilization: util as number })) : []

  // Alert correlation analysis
  const alertsWithMetrics = data
    ? data.alerts.map((alert: string) => {
        const machineMatch = alert.match(/^([A-Z0-9]+)/)
        const machineId = machineMatch ? machineMatch[1] : null
        const machine = machines.find(m => m.id === machineId)
        return {
          message: alert,
          machineId,
          utilization: machine?.utilization ?? 0,
          isAtRiskMachine: (machine?.utilization ?? 0) < avgMachineUtilization * 0.6, // More than 40% below average
        }
      })
    : []

  const alertsCorrelatedWithLowUtil = alertsWithMetrics.filter(a => a.isAtRiskMachine).length
  const alertCorrelationPercentage = alertCount > 0 ? ((alertsCorrelatedWithLowUtil / alertCount) * 100).toFixed(0) : 0

  // Revenue by category data (pie chart)
  const revenuePieData = data
    ? data.revenue_by_category.labels.map((label: string, idx: number) => ({
        name: label,
        value: data.revenue_by_category.values[idx],
      }))
    : []

  // Weekly profit data (line chart)
  const weeklyProfitData = data
    ? data.weekly_profit.labels.map((label: string, idx: number) => ({
        week: label,
        profit: data.weekly_profit.values[idx] / 1000,
      }))
    : []

  // Profit trend metrics
  const getProfitMetrics = () => {
    if (!data || !data.weekly_profit.values.length) return null
    
    const profits = data.weekly_profit.values
    const labels = data.weekly_profit.labels
    
    const totalProfit = profits.reduce((sum, val) => sum + val, 0)
    const avgProfit = totalProfit / profits.length
    const maxProfit = Math.max(...profits)
    const minProfit = Math.min(...profits)
    const maxDay = labels[profits.indexOf(maxProfit)]
    const minDay = labels[profits.indexOf(minProfit)]
    
    // Calculate day-over-day changes
    const changes = []
    for (let i = 1; i < profits.length; i++) {
      const change = profits[i] - profits[i - 1]
      const percentChange = ((change / profits[i - 1]) * 100)
      changes.push({
        from: labels[i - 1],
        to: labels[i],
        change,
        percentChange,
      })
    }
    
    // Trend: overall direction
    const firstHalf = profits.slice(0, Math.ceil(profits.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(profits.length / 2)
    const secondHalf = profits.slice(Math.ceil(profits.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(profits.length / 2)
    const weekOverWeekChange = secondHalf - firstHalf
    const weekOverWeekPercent = ((weekOverWeekChange / firstHalf) * 100)
    
    // Volatility (standard deviation)
    const variance = profits.reduce((sum, val) => sum + Math.pow(val - avgProfit, 2), 0) / profits.length
    const stdDev = Math.sqrt(variance)
    const cv = (stdDev / avgProfit) * 100
    
    return {
      totalProfit,
      avgProfit,
      maxProfit,
      minProfit,
      maxDay,
      minDay,
      weekOverWeekChange,
      weekOverWeekPercent,
      volatility: cv,
      dayOverDayChanges: changes,
    }
  }
  
  const profitMetrics = getProfitMetrics()

  // Top locations treemap data
  const locationsTreemapData = data
    ? Object.entries(data.top_locations)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 8)
        .map(([location, revenue]) => ({
          name: location,
          value: (revenue as number) / 1000,
        }))
    : []

  // Location grouping with analytics
  const getLocationAnalytics = () => {
    if (!data) return []
    
    const locationRevenue = Object.entries(data.top_locations).map(([location, revenue]) => ({
      location,
      revenue: revenue as number,
    }))
    
    const locationCoordinates = (data.map || []).reduce((acc: any, loc: any) => {
      acc[loc.location] = { lat: loc.lat, lon: loc.lon }
      return acc
    }, {})
    
    const totalLocationRevenue = locationRevenue.reduce((sum, loc) => sum + loc.revenue, 0)
    
    return locationRevenue
      .sort((a, b) => b.revenue - a.revenue)
      .map((loc, idx) => {
        const revenuePercent = ((loc.revenue / totalLocationRevenue) * 100).toFixed(1)
        const coords = locationCoordinates[loc.location]
        
        return {
          rank: idx + 1,
          location: loc.location,
          revenue: loc.revenue,
          revenuePercent: parseFloat(revenuePercent),
          lat: coords?.lat,
          lon: coords?.lon,
        }
      })
  }
  
  const locationAnalytics = getLocationAnalytics()

  // Health status
  const healthStatus = {
    healthy: machines.filter((m) => m.utilization >= 70).length,
    warning: machines.filter((m) => m.utilization >= 40 && m.utilization < 70).length,
    critical: machines.filter((m) => m.utilization < 40).length,
  }

  // Statistical calculations
  const calculateStats = () => {
    if (machines.length === 0) return null
    const utils = machines.map(m => m.utilization).sort((a, b) => a - b)
    const sum = utils.reduce((a, b) => a + b, 0)
    const mean = sum / utils.length
    const median = utils.length % 2 === 0 ? (utils[utils.length / 2 - 1] + utils[utils.length / 2]) / 2 : utils[Math.floor(utils.length / 2)]
    const variance = utils.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / utils.length
    const stdDev = Math.sqrt(variance)
    const q1Idx = Math.floor(utils.length * 0.25)
    const q3Idx = Math.floor(utils.length * 0.75)
    const q1 = utils[q1Idx]
    const q3 = utils[q3Idx]
    const iqr = q3 - q1
    const cv = (stdDev / mean) * 100 // Coefficient of Variation
    
    // Outlier detection: >2 standard deviations from mean
    const upperThreshold = mean + 2 * stdDev
    const lowerThreshold = Math.max(0, mean - 2 * stdDev)
    const outliers = machines.filter(m => m.utilization > upperThreshold || m.utilization < lowerThreshold)
    
    return {
      mean: mean.toFixed(1),
      median: median.toFixed(1),
      stdDev: stdDev.toFixed(1),
      min: utils[0].toFixed(1),
      max: utils[utils.length - 1].toFixed(1),
      range: (utils[utils.length - 1] - utils[0]).toFixed(1),
      q1: q1.toFixed(1),
      q3: q3.toFixed(1),
      iqr: iqr.toFixed(1),
      cv: cv.toFixed(1),
      q1Count: machines.filter(m => m.utilization <= q1).length,
      q2Count: machines.filter(m => m.utilization > q1 && m.utilization <= median).length,
      q3Count: machines.filter(m => m.utilization > median && m.utilization <= q3).length,
      q4Count: machines.filter(m => m.utilization > q3).length,
      outliers: outliers,
      outlierUpperThreshold: upperThreshold.toFixed(1),
      outlierLowerThreshold: lowerThreshold.toFixed(1),
    }
  }

  const stats = calculateStats()

  // Colors
  const COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#fb923c', '#a1e8af', '#91d5ff']

  // Styles
  const navbarStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
  }

  const contentStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%)',
    minHeight: '100vh',
    display: 'flex',
    flexDirection:'column'
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
  }

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: '8px 8px 0 0',
    border: `2px solid ${isActive ? '#60a5fa' : 'transparent'}`,
    backgroundColor: isActive ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
    color: isActive ? '#93c5fd' : 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: isActive ? '600' : '500',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  })

  return (
    <div style={contentStyle}>
      {/* Navbar */}
      <nav style={navbarStyle}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#fff', margin: 0 }}>BIA Dashboard</h1>
              <p style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', margin: '2px 0 0 0' }}>
                Real-time Vending Machine Intelligence System
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={refresh}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: loading ? 0.5 : 1,
                  fontSize: '13px',
                }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px', borderRight: '1px solid rgba(255, 255, 255, 0.1)', paddingRight: '12px' }}>
                {user?.email}
              </span>
              <button
                onClick={() => {
                  logout()
                  window.location.href = '/login'
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#fecaca',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  fontSize: '13px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Alert Banner (if issues exist) */}
      {alertCount > 0 && (
        <div
          onClick={() => setActiveTab('machines')}
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.08) 100%)',
            borderBottom: '2px solid rgba(239, 68, 68, 0.4)',
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.25) 0%, rgba(239, 68, 68, 0.15) 100%)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.08) 100%)'
          }}
        >
          <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle style={{ color: '#ef4444', width: '20px', height: '20px', flexShrink: 0 }} />
            <span style={{ color: '#fecaca', fontSize: '13px', fontWeight: '500' }}>
              {alertCount} active {alertCount === 1 ? 'alert' : 'alerts'} • Review machines immediately
            </span>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.3)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px 16px',
        }}
      >
        <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('executive')}
            style={tabButtonStyle(activeTab === 'executive')}
          >
            <BarChart3 className="h-4 w-4" />
            Executive View
          </button>
          <button
            onClick={() => setActiveTab('machines')}
            style={tabButtonStyle(activeTab === 'machines')}
          >
            <Zap className="h-4 w-4" />
            Machines
          </button>
          <button
            onClick={() => setActiveTab('geographic')}
            style={tabButtonStyle(activeTab === 'geographic')}
          >
            <MapPin className="h-4 w-4" />
            Geographic
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            style={tabButtonStyle(activeTab === 'locations')}
          >
            <MapPin className="h-4 w-4" />
            Locations
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            style={tabButtonStyle(activeTab === 'analytics')}
          >
            <BarChart3 className="h-4 w-4" />
            Analytics
          </button>
        </div>
      </div>

      {/* Slicer Bar */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '12px 16px',
        }}
      >
        <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date Range Slicer */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '500' }}>📅 Period:</span>
            {(['week', 'month', 'quarter'] as const).map(period => (
              <button
                key={period}
                onClick={() => setDateRange(period)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: dateRange === period ? '1px solid rgba(96, 165, 250, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: dateRange === period ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
                  color: dateRange === period ? '#93c5fd' : 'rgba(255, 255, 255, 0.5)',
                  fontSize: '11px',
                  fontWeight: dateRange === period ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          {/* Location Slicer */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '500' }}>📍 Location:</span>
            <select
              value={selectedLocation || ''}
              onChange={(e) => setSelectedLocation(e.target.value || null)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                fontSize: '11px',
                cursor: 'pointer',
              }}
            >
              <option value="">All Locations</option>
              {data?.machine_utilization && Object.keys(data.machine_utilization).map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Machine Status Slicer */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '500' }}>🔧 Status:</span>
            {(['all', 'healthy', 'warning', 'critical'] as const).map(status => (
              <button
                key={status}
                onClick={() => setMachineStatus(status)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: machineStatus === status ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                  backgroundColor: machineStatus === status 
                    ? status === 'critical' ? 'rgba(239, 68, 68, 0.2)' 
                    : status === 'warning' ? 'rgba(235, 179, 8, 0.2)'
                    : 'rgba(34, 197, 94, 0.2)'
                    : 'transparent',
                  color: machineStatus === status 
                    ? status === 'critical' ? '#fca5a5' 
                    : status === 'warning' ? '#fbbf24'
                    : '#86efac'
                    : 'rgba(255, 255, 255, 0.4)',
                  fontSize: '10px',
                  fontWeight: machineStatus === status ? '600' : '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'capitalize',
                }}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              setDateRange('week')
              setSelectedLocation(null)
              setMachineStatus('all')
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: 'transparent',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '11px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginLeft: 'auto',
            }}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: '1600px', margin: '0 auto', width: '100%', padding: '24px 16px' }}>
        {error && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              color: '#fecaca',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        )}

        {/* EXECUTIVE VIEW TAB */}
        {activeTab === 'executive' && (
          <div>
            {/* KPI Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                marginBottom: '18px',
              }}
            >
              <KPICard title="Total Revenue" value={`$${(totalRevenue / 1000).toFixed(1)}K`} icon="revenue" loading={loading} />
              <KPICard title="Machines" value={machineCount} icon="machines" loading={loading} />
              <KPICard title="Avg Utilization" value={`${avgMachineUtilization.toFixed(1)}%`} icon="utilization" loading={loading} />
              <KPICard title="Alerts" value={alertCount} icon="alerts" loading={loading} />
            </div>

            {/* 3-Column Layout */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '14px',
                marginBottom: '18px',
              }}
            >
              {/* Revenue Distribution Pie */}
              <div style={{ ...cardStyle, padding: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 10px 0' }}>
                  Revenue by Category
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={revenuePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {revenuePieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => `$${(value / 1000).toFixed(1)}K`}
                      contentStyle={{
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        border: '1px solid rgba(96, 165, 250, 0.3)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Weekly Profit Trend */}
              <div style={{ ...cardStyle, padding: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 10px 0' }}>
                  Weekly Profit Trend
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyProfitData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
                    <XAxis dataKey="week" stroke="rgba(255, 255, 255, 0.4)" style={{ fontSize: '10px' }} />
                    <YAxis stroke="rgba(255, 255, 255, 0.4)" style={{ fontSize: '10px' }} />
                    <Tooltip
                      formatter={(value: any) => `$${value.toFixed(1)}K`}
                      contentStyle={{
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        border: '1px solid rgba(96, 165, 250, 0.3)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      dot={{ fill: '#93c5fd', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Health Status */}
              <div style={{ ...cardStyle, padding: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 10px 0' }}>
                  Fleet Health
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#86efac' }}>Healthy</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#86efac' }}>{healthStatus.healthy}</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px' }}>
                      <div
                        style={{
                          height: '100%',
                          backgroundColor: '#22c55e',
                          width: `${(healthStatus.healthy / machineCount) * 100}%`,
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#fbbf24' }}>Warning</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#fbbf24' }}>{healthStatus.warning}</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px' }}>
                      <div
                        style={{
                          height: '100%',
                          backgroundColor: '#eab308',
                          width: `${(healthStatus.warning / machineCount) * 100}%`,
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#fecaca' }}>Critical</span>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: '#fecaca' }}>{healthStatus.critical}</span>
                    </div>
                    <div style={{ height: '6px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px' }}>
                      <div
                        style={{
                          height: '100%',
                          backgroundColor: '#ef4444',
                          width: `${(healthStatus.critical / machineCount) * 100}%`,
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Locations Treemap + Scatter */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px',
              }}
            >
              {/* Location Revenue Treemap */}
              <div style={{ ...cardStyle, padding: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 10px 0' }}>
                  Top Locations by Revenue
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <Treemap
                    data={locationsTreemapData}
                    dataKey="value"
                    stroke="#f0f0f0"
                    fill="#8884d8"
                  >
                    {locationsTreemapData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Treemap>
                </ResponsiveContainer>
              </div>

              {/* Utilization Distribution Bar */}
              <div style={{ ...cardStyle, padding: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 10px 0' }}>
                  Utilization Distribution
                </h3>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={[
                      { range: '0-20%', count: machines.filter((m) => m.utilization < 20).length, fill: '#ef4444' },
                      { range: '20-40%', count: machines.filter((m) => m.utilization >= 20 && m.utilization < 40).length, fill: '#f97316' },
                      { range: '40-60%', count: machines.filter((m) => m.utilization >= 40 && m.utilization < 60).length, fill: '#eab308' },
                      { range: '60-80%', count: machines.filter((m) => m.utilization >= 60 && m.utilization < 80).length, fill: '#84cc16' },
                      { range: '80-100%', count: machines.filter((m) => m.utilization >= 80).length, fill: '#22c55e' },
                    ]}
                    margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
                    <XAxis dataKey="range" stroke="rgba(255, 255, 255, 0.4)" style={{ fontSize: '10px' }} />
                    <YAxis stroke="rgba(255, 255, 255, 0.4)" style={{ fontSize: '10px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(26, 26, 46, 0.95)',
                        border: '1px solid rgba(96, 165, 250, 0.3)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Quick Alert Summary - Link to Analytics */}
            {alertCount > 0 && (
              <div
                style={{
                  marginTop: '18px',
                  ...cardStyle,
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderLeft: '3px solid #ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '13px', color: '#fca5a5' }}>
                  ⚠️ {alertCount} active alert{alertCount !== 1 ? 's' : ''} detected • {alertsCorrelatedWithLowUtil} correlated with low utilization
                </span>
                <button
                  onClick={() => setActiveTab('analytics')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#fca5a5',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  View Analysis →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS TAB - Deep Dive Analysis */}
        {activeTab === 'analytics' && (
          <div>
            {/* Statistical Analysis Section */}
            {stats && (
              <div
                style={{
                  marginBottom: '18px',
                  ...cardStyle,
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#a5f3fc', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  📊 Statistical Analysis
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: '12px',
                  }}
                >
                </div>

                {/* Statistics as Table */}
                <div style={{ ...cardStyle, padding: '0', marginTop: '12px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', borderBottom: '1px solid rgba(99, 102, 241, 0.3)' }}>
                        <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#a5f3fc', textTransform: 'uppercase' }}>Metric</th>
                        <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: '11px', fontWeight: '700', color: '#a5f3fc', textTransform: 'uppercase' }}>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Mean', value: `${stats.mean}%`, color: '#60a5fa' },
                        { label: 'Median', value: `${stats.median}%`, color: '#a78bfa' },
                        { label: 'Std Dev', value: `${stats.stdDev}%`, color: '#fbbf24' },
                        { label: 'Coefficient of Variation', value: `${stats.cv}%`, color: '#fb923c' },
                        { label: 'Min', value: `${stats.min}%`, color: '#f87171' },
                        { label: 'Max', value: `${stats.max}%`, color: '#22c55e' },
                        { label: 'Range (Span)', value: `${stats.range}%`, color: '#34d399' },
                        { label: 'Q1', value: `${stats.q1}%`, color: '#a1e8af' },
                        { label: 'Q3', value: `${stats.q3}%`, color: '#91d5ff' },
                        { label: 'IQR', value: `${stats.iqr}%`, color: '#cbd5e1' },
                      ].map((row, idx) => (
                        <tr
                          key={`stat-${idx}`}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.01)',
                          }}
                        >
                          <td style={{ padding: '12px 16px', fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                            {row.label}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '700', color: row.color, textAlign: 'right' }}>
                            {row.value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Quartile Distribution Bar */}
                <div style={{ ...cardStyle, padding: '14px', marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '10px' }}>
                    Quartile Distribution
                  </div>
                  <div style={{ height: '32px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', display: 'flex', overflow: 'hidden', gap: '2px', padding: '2px' }}>
                    {[
                      { label: 'Q1', count: stats.q1Count, color: '#ef4444', range: `< ${stats.q1}%` },
                      { label: 'Q2', count: stats.q2Count, color: '#f97316', range: `${stats.q1}% - ${stats.median}%` },
                      { label: 'Q3', count: stats.q3Count, color: '#eab308', range: `${stats.median}% - ${stats.q3}%` },
                      { label: 'Q4', count: stats.q4Count, color: '#22c55e', range: `> ${stats.q3}%` },
                    ].map((q, i) => {
                      const width = (q.count / machines.length) * 100
                      return (
                        <div
                          key={`q-${i}`}
                          style={{
                            flex: width,
                            backgroundColor: q.color,
                            borderRadius: '4px',
                            opacity: 0.8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: width > 8 ? undefined : '0px',
                            transition: 'opacity 0.3s ease',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                          title={`${q.label}: ${q.count} machines (${((q.count / machines.length) * 100).toFixed(1)}%)`}
                        >
                          {width > 15 && (
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#000', zIndex: 1, textShadow: '0 0 2px rgba(255,255,255,0.5)' }}>
                              {q.count}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '11px' }}>
                    {[
                      { label: 'Q1 (Bottom)', color: '#ef4444', range: `< ${stats.q1}%` },
                      { label: 'Q2 (Lower)', color: '#f97316', range: `${stats.q1}% - ${stats.median}%` },
                      { label: 'Q3 (Upper)', color: '#eab308', range: `${stats.median}% - ${stats.q3}%` },
                      { label: 'Q4 (Top)', color: '#22c55e', range: `> ${stats.q3}%` },
                    ].map((q, i) => (
                      <div key={`qlegend-${i}`} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <div style={{ width: '8px', height: '8px', backgroundColor: q.color, borderRadius: '2px' }} />
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          <div style={{ fontSize: '10px', fontWeight: '600' }}>{q.label}</div>
                          <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)' }}>{q.range}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Profit Trend Metrics */}
            {profitMetrics && (
              <div style={{ 
                marginBottom: '18px',
                ...cardStyle,
                borderRadius: '12px',
                padding: '16px',
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#86efac', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  💰 Profit Trend Analysis
                </h3>
                
                {/* Profit Trend Line Chart */}
                <div style={{ ...cardStyle, padding: '20px', marginBottom: '14px', minHeight: '250px' }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={weeklyProfitData}
                      margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                      <XAxis 
                        dataKey="week" 
                        stroke="rgba(255, 255, 255, 0.4)"
                        style={{ fontSize: '11px' }}
                      />
                      <YAxis 
                        stroke="rgba(255, 255, 255, 0.4)"
                        style={{ fontSize: '11px' }}
                        label={{ value: '$K', angle: -90, position: 'insideLeft', style: { color: 'rgba(255, 255, 255, 0.4)' } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(26, 26, 46, 0.95)',
                          border: '1px solid rgba(132, 204, 22, 0.3)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(value: any) => typeof value === 'number' ? `$${value.toFixed(1)}K` : value}
                      />
                      <Line
                        type="monotone"
                        dataKey="profit"
                        stroke="#86efac"
                        strokeWidth={3}
                        dot={{ fill: '#22c55e', r: 5 }}
                        activeDot={{ r: 7 }}
                        isAnimationActive={true}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '14px' }}>
                  {/* Total Profit */}
                  <div style={{ ...cardStyle, padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                      Total Weekly Profit
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981', marginBottom: '4px' }}>
                      ${(profitMetrics.totalProfit / 1000).toFixed(1)}K
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>
                      {profitMetrics.dayOverDayChanges.length} days
                    </div>
                  </div>

                  {/* Best Day */}
                  <div style={{ ...cardStyle, padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                      Best Day
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#86efac', marginBottom: '4px' }}>
                      ${(profitMetrics.maxProfit / 1000).toFixed(1)}K
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>
                      {profitMetrics.maxDay}
                    </div>
                  </div>

                  {/* Worst Day */}
                  <div style={{ ...cardStyle, padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                      Worst Day
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#fca5a5', marginBottom: '4px' }}>
                      ${(profitMetrics.minProfit / 1000).toFixed(1)}K
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>
                      {profitMetrics.minDay}
                    </div>
                  </div>

                  {/* Week-over-Week Change */}
                  <div style={{ ...cardStyle, padding: '14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                      Trend (1st vs 2nd Half)
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: profitMetrics.weekOverWeekChange >= 0 ? '#86efac' : '#fca5a5', marginBottom: '4px' }}>
                      {profitMetrics.weekOverWeekPercent.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.7)' }}>
                      {profitMetrics.weekOverWeekChange >= 0 ? '📈 Improving' : '📉 Declining'}
                    </div>
                  </div>
                </div>

                {/* Day-over-Day Changes - Bar Chart */}
                <div style={{ 
                  ...cardStyle, 
                  padding: '20px',
                  minHeight: '280px',
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#f97316', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📈 Daily Changes
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={profitMetrics.dayOverDayChanges.map(change => ({
                        name: `${change.from}→${change.to}`,
                        change: parseFloat((change.change / 1000).toFixed(1)),
                        percent: parseFloat(change.percentChange.toFixed(1)),
                      }))}
                      margin={{ top: 10, right: 20, left: 0, bottom: 40 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                      <XAxis 
                        dataKey="name" 
                        stroke="rgba(255, 255, 255, 0.4)"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        style={{ fontSize: '10px' }}
                      />
                      <YAxis 
                        stroke="rgba(255, 255, 255, 0.4)"
                        style={{ fontSize: '10px' }}
                        label={{ value: '$K', angle: -90, position: 'insideLeft', style: { color: 'rgba(255, 255, 255, 0.4)' } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(26, 26, 46, 0.95)',
                          border: '1px solid rgba(251, 146, 60, 0.3)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                        }}
                        formatter={(value: any) => typeof value === 'number' ? `$${value.toFixed(1)}K` : value}
                      />
                      <Bar
                        dataKey="change"
                        fill="#f97316"
                        radius={[4, 4, 0, 0]}
                        isAnimationActive={true}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Alert Correlation Analysis Panel */}
            {alertCount > 0 && (
              <div style={{ 
                marginBottom: '18px',
                ...cardStyle,
                borderRadius: '12px',
                padding: '16px',
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#fca5a5', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  ⚠️ Alert Correlation Analysis
                </h3>
                
                {/* Alert Distribution Bar */}
                <div style={{ ...cardStyle, padding: '20px', marginBottom: '14px', minHeight: '120px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '14px' }}>
                    Alert Status Distribution
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Stacked Bar */}
                    <div style={{ height: '32px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', display: 'flex', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <div
                        style={{
                          flex: alertsCorrelatedWithLowUtil,
                          backgroundColor: '#ef4444',
                          opacity: 0.8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: '700',
                        }}
                      >
                        {alertsCorrelatedWithLowUtil > 0 && `${alertsCorrelatedWithLowUtil}`}
                      </div>
                      <div
                        style={{
                          flex: alertCount - alertsCorrelatedWithLowUtil,
                          backgroundColor: '#60a5fa',
                          opacity: 0.8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: '700',
                        }}
                      >
                        {(alertCount - alertsCorrelatedWithLowUtil) > 0 && `${alertCount - alertsCorrelatedWithLowUtil}`}
                      </div>
                    </div>
                    
                    {/* Legend */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '11px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '2px' }} />
                        <div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>
                            Correlated: {alertsCorrelatedWithLowUtil}
                          </div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px' }}>
                            {alertCorrelationPercentage}% of alerts
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ width: '12px', height: '12px', backgroundColor: '#60a5fa', borderRadius: '2px' }} />
                        <div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: '600' }}>
                            Normal Ops: {alertCount - alertsCorrelatedWithLowUtil}
                          </div>
                          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px' }}>
                            {((((alertCount - alertsCorrelatedWithLowUtil) / alertCount) * 100)).toFixed(0)}% of alerts
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Alert Details List */}
                <div style={{ ...cardStyle, padding: '14px', maxHeight: '280px', overflowY: 'auto' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '10px' }}>
                    Alert Details
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {alertsWithMetrics.map((alert, idx) => (
                      <div
                        key={`alert-${idx}`}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          padding: '12px',
                          backgroundColor: alert.isAtRiskMachine ? 'rgba(239, 68, 68, 0.08)' : 'rgba(96, 165, 250, 0.05)',
                          border: `1px solid ${alert.isAtRiskMachine ? 'rgba(239, 68, 68, 0.2)' : 'rgba(96, 165, 250, 0.2)'}`,
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      >
                        {/* Row 1: Machine ID + Utilization + Status */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                            <div
                              style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                backgroundColor: alert.isAtRiskMachine ? 'rgba(239, 68, 68, 0.2)' : 'rgba(96, 165, 250, 0.2)',
                                color: alert.isAtRiskMachine ? '#fca5a5' : '#93c5fd',
                                fontSize: '11px',
                                fontWeight: '700',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {alert.machineId || 'Unknown'}
                            </div>
                            <div style={{ color: '#e0e0e0', fontSize: '12px', fontWeight: '500' }}>
                              {alert.message.substring(alert.message.indexOf(' ') + 1)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                            <div
                              style={{
                                padding: '4px 8px',
                                borderRadius: '3px',
                                backgroundColor: alert.isAtRiskMachine ? 'rgba(239, 68, 68, 0.2)' : 'rgba(96, 165, 250, 0.2)',
                                color: alert.isAtRiskMachine ? '#fca5a5' : '#93c5fd',
                                fontSize: '11px',
                                fontWeight: '600',
                              }}
                            >
                              {(alert.utilization ?? 0).toFixed(1)}%
                            </div>
                            {alert.isAtRiskMachine && (
                              <div
                                style={{
                                  fontSize: '9px',
                                  padding: '3px 6px',
                                  borderRadius: '2px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.3)',
                                  color: '#fca5a5',
                                  fontWeight: '700',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                AT RISK
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MACHINES TAB */}
        {activeTab === 'machines' && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '14px',
              }}
            >
              {/* Top Machines */}
              <div style={{ ...cardStyle, padding: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#22c55e', margin: '0 0 10px 0' }}>
                  Top 10 Performing Machines
                </h3>
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {[...machines]
                    .sort((a, b) => b.utilization - a.utilization)
                    .slice(0, 10)
                    .map((m, i) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 0',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          {i + 1}. {m.id}
                        </span>
                        <span style={{ color: '#86efac', fontWeight: '600' }}>{m.utilization.toFixed(1)}%</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Bottom Machines */}
              <div style={{ ...cardStyle, padding: '14px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fecaca', margin: '0 0 10px 0' }}>
                  Bottom 10 (Needs Attention)
                </h3>
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {[...machines]
                    .sort((a, b) => a.utilization - b.utilization)
                    .slice(0, 10)
                    .map((m, i) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 0',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          fontSize: '12px',
                        }}
                      >
                        <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                          {i + 1}. {m.id}
                        </span>
                        <span style={{ color: '#fca5a5', fontWeight: '600' }}>{m.utilization.toFixed(1)}%</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Machine Heatmap/Grid */}
            <div style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>
                Machine Heatmap - Complete Fleet Overview
              </h3>
              <div style={{ ...cardStyle, padding: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                  {[...machines]
                    .sort((a, b) => a.id.localeCompare(b.id))
                    .map((m) => {
                      const util = m.utilization
                      // Color gradient: red (0%) to yellow (50%) to green (100%)
                      let color = '#ef4444'
                      if (util >= 80) color = '#10b981' // Green
                      else if (util >= 60) color = '#84cc16' // Yellow-green
                      else if (util >= 40) color = '#eab308' // Yellow
                      else if (util >= 20) color = '#f97316' // Orange
                      // else red
                      
                      const bgColor = util >= 80 ? 'rgba(16, 185, 129, 0.1)' :
                                      util >= 60 ? 'rgba(132, 204, 22, 0.1)' :
                                      util >= 40 ? 'rgba(234, 179, 8, 0.1)' :
                                      util >= 20 ? 'rgba(249, 115, 22, 0.1)' :
                                      'rgba(239, 68, 68, 0.1)'
                      
                      return (
                        <div
                          key={m.id}
                          style={{
                            ...cardStyle,
                            padding: '12px',
                            backgroundColor: bgColor,
                            borderColor: color,
                            borderWidth: '1.5px',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#fff', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.id}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: color }}>
                              {util.toFixed(0)}%
                            </div>
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${util}%`,
                                height: '100%',
                                backgroundColor: color,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' }} />
                    <span>Elite (80%+)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#84cc16', borderRadius: '2px' }} />
                    <span>High (60-79%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#eab308', borderRadius: '2px' }} />
                    <span>Average (40-59%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#f97316', borderRadius: '2px' }} />
                    <span>Low (20-39%)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '2px' }} />
                    <span>Critical (&lt;20%)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Tier Segmentation */}
            <div style={{ marginTop: '16px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>
                Performance Tier Segmentation
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '14px' }}>
                {[
                  { tier: 'Elite', range: '90-100%', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)', count: machines.filter(m => m.utilization >= 90).length },
                  { tier: 'High', range: '70-89%', color: '#84cc16', bgColor: 'rgba(132, 204, 22, 0.15)', count: machines.filter(m => m.utilization >= 70 && m.utilization < 90).length },
                  { tier: 'Average', range: '40-69%', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)', count: machines.filter(m => m.utilization >= 40 && m.utilization < 70).length },
                  { tier: 'Low', range: '20-39%', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)', count: machines.filter(m => m.utilization >= 20 && m.utilization < 40).length },
                  { tier: 'Critical', range: '<20%', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', count: machines.filter(m => m.utilization < 20).length },
                ].map((tier, idx) => {
                  const percentage = ((tier.count / machines.length) * 100).toFixed(1)
                  return (
                    <div key={`tier-${idx}`} style={{ ...cardStyle, padding: '12px', textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', fontWeight: '600', color: tier.color, marginBottom: '8px', textTransform: 'uppercase' }}>
                        {tier.tier}
                      </div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: tier.color, marginBottom: '4px' }}>
                        {tier.count}
                      </div>
                      <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '6px' }}>
                        {percentage}% of fleet
                      </div>
                      <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: '500' }}>
                        {tier.range}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Tier Distribution Bar */}
              <div style={{ ...cardStyle, padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '12px' }}>
                  Fleet Composition
                </div>
                <div style={{ height: '24px', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '4px', display: 'flex', overflow: 'hidden' }}>
                  {[
                    { count: machines.filter(m => m.utilization >= 90).length, color: '#10b981' },
                    { count: machines.filter(m => m.utilization >= 70 && m.utilization < 90).length, color: '#84cc16' },
                    { count: machines.filter(m => m.utilization >= 40 && m.utilization < 70).length, color: '#eab308' },
                    { count: machines.filter(m => m.utilization >= 20 && m.utilization < 40).length, color: '#f97316' },
                    { count: machines.filter(m => m.utilization < 20).length, color: '#ef4444' },
                  ].map((segment, idx) => {
                    const width = (segment.count / machines.length) * 100
                    return (
                      <div
                        key={`seg-${idx}`}
                        style={{
                          flex: width,
                          backgroundColor: segment.color,
                          opacity: 0.7,
                          minWidth: width > 5 ? undefined : '2px',
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Outlier Detection */}
            {stats && stats.outliers && stats.outliers.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>
                  Anomaly Detection - Statistical Outliers
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ ...cardStyle, padding: '14px', textAlign: 'center', borderColor: 'rgba(168, 85, 247, 0.3)' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                      Outliers Detected
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: '#a855f7' }}>
                      {stats.outliers.length}
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
                      {((stats.outliers.length / machines.length) * 100).toFixed(1)}% of fleet
                    </div>
                  </div>
                  <div style={{ ...cardStyle, padding: '14px' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px', fontWeight: '600' }}>
                      Threshold Range
                    </div>
                    <div style={{ fontSize: '12px', color: '#e0e0e0', lineHeight: '1.6' }}>
                      <div>Lower: &lt; {stats.outlierLowerThreshold}%</div>
                      <div>Upper: &gt; {stats.outlierUpperThreshold}%</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '6px' }}>
                        (±2σ from mean)
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ ...cardStyle, padding: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '10px' }}>
                    Outlier Machines
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
                    {stats.outliers.map((m) => {
                      const util = m.utilization
                      const meanVal = parseFloat(stats.mean)
                      const type = util > meanVal ? 'High' : 'Low'
                      const typeColor = util > meanVal ? '#8b5cf6' : '#f97316'
                      const bgColor = util > meanVal ? 'rgba(139, 92, 246, 0.1)' : 'rgba(249, 115, 22, 0.1)'
                      
                      return (
                        <div
                          key={m.id}
                          style={{
                            ...cardStyle,
                            padding: '10px',
                            backgroundColor: bgColor,
                            borderColor: typeColor,
                            borderWidth: '1.5px',
                            textAlign: 'center',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: '600', color: '#fff', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.id}
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: typeColor, marginBottom: '4px' }}>
                            {util.toFixed(1)}%
                          </div>
                          <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.6)', backgroundColor: typeColor + '20', padding: '3px 6px', borderRadius: '3px' }}>
                            {type} Outlier
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {stats && (!stats.outliers || stats.outliers.length === 0) && (
              <div style={{ marginTop: '16px' }}>
                <div style={{ ...cardStyle, padding: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#10b981', marginBottom: '8px' }}>
                    ✓ No Outliers Detected
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                    All machines are within normal operating range (±2σ from mean)
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* GEOGRAPHIC TAB */}
        {activeTab === 'geographic' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
            {/* Map Visualization */}
            <div style={{ ...cardStyle, padding: '20px', minHeight: '450px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 16px 0' }}>
                Location Map & Performance
              </h3>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '380px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                }}
              >
                <svg width="100%" height="100%" style={{ display: 'block' }}>
                  {/* Grid background */}
                  <defs>
                    <pattern id="grid-bg" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid-bg)" />

                  {/* Location bubbles */}
                  {data?.map.map((location, idx) => {
                    const revenue = (data.top_locations[location.location] || 0) / 1000
                    const maxRevenue = Math.max(...Object.values(data.top_locations).map((r: any) => r / 1000))
                    const size = Math.max(25, (revenue / maxRevenue) * 70)
                    
                    // Better positioning: spread locations across the canvas
                    const svgWidth = 450
                    const svgHeight = 380
                    const padding = 60
                    const cols = 2
                    const row = Math.floor(idx / cols)
                    const col = idx % cols
                    
                    const x = padding + col * (svgWidth - padding * 2) / cols + (svgWidth - padding * 2) / (cols * 2)
                    const y = padding + row * (svgHeight - padding * 2) / Math.ceil(data.map.length / cols) + (svgHeight - padding * 2) / (Math.ceil(data.map.length / cols) * 2)

                    return (
                      <g key={`loc-${idx}`}>
                        <circle
                          cx={x}
                          cy={y}
                          r={size}
                          fill={`hsl(${idx * 85}, 70%, 50%)`}
                          opacity="0.65"
                          style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.setAttribute('r', `${size * 1.3}`)
                            e.currentTarget.setAttribute('opacity', '0.95')
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.setAttribute('r', `${size}`)
                            e.currentTarget.setAttribute('opacity', '0.65')
                          }}
                        />
                        <text
                          x={x}
                          y={y - 8}
                          textAnchor="middle"
                          fontSize="12"
                          fontWeight="700"
                          fill="#fff"
                          pointerEvents="none"
                        >
                          ${revenue.toFixed(0)}K
                        </text>
                        <text
                          x={x}
                          y={y + 6}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="500"
                          fill="#fff"
                          pointerEvents="none"
                          opacity="0.8"
                        >
                          {location.location.substring(0, 12)}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>
              <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                Circle size = Revenue | Color = Location | Hover for details
              </div>
            </div>

            {/* Locations List */}
            <div style={{ ...cardStyle, padding: '14px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>
                All Locations
              </h3>
              <div style={{ flex: 1, overflowY: 'auto' }}>
                {data?.map.map((location, idx) => {
                  const revenue = (data.top_locations[location.location] || 0) / 1000
                  const isTopLocation = location.location in data.top_locations
                  return (
                    <div
                      key={`loc-list-${idx}`}
                      style={{
                        padding: '10px',
                        marginBottom: '8px',
                        backgroundColor: isTopLocation ? 'rgba(96, 165, 250, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '8px',
                        border: `1px solid ${isTopLocation ? 'rgba(96, 165, 250, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isTopLocation ? 'rgba(96, 165, 250, 0.2)' : 'rgba(255, 255, 255, 0.08)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isTopLocation ? 'rgba(96, 165, 250, 0.1)' : 'rgba(255, 255, 255, 0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>
                          {location.location}
                        </span>
                        {isTopLocation && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '700',
                              color: '#fbbf24',
                              backgroundColor: 'rgba(251, 191, 36, 0.2)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            TOP
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>
                        Revenue: <span style={{ color: '#60a5fa', fontWeight: '600' }}>${revenue.toFixed(1)}K</span>
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' }}>
                        Lat: {location.lat.toFixed(4)} | Lon: {location.lon.toFixed(4)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* LOCATIONS TAB */}
        {activeTab === 'locations' && (
          <div>
            {/* Location Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
              <div style={{ ...cardStyle, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                  Total Locations
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#60a5fa' }}>
                  {locationAnalytics.length}
                </div>
              </div>
              <div style={{ ...cardStyle, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                  Total Location Revenue
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                  ${(locationAnalytics.reduce((sum, loc) => sum + loc.revenue, 0) / 1000).toFixed(0)}K
                </div>
              </div>
              <div style={{ ...cardStyle, padding: '14px', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '6px' }}>
                  Top Location Revenue
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: '#fbbf24' }}>
                  ${(locationAnalytics[0]?.revenue / 1000).toFixed(0)}K
                </div>
              </div>
            </div>

            {/* Location Detailed Table */}
            <div style={{ ...cardStyle, padding: '14px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>
                Location Performance Breakdown
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                        Rank
                      </th>
                      <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                        Location
                      </th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                        Revenue
                      </th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                        % of Total
                      </th>
                      <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: '11px', fontWeight: '600', color: 'rgba(255, 255, 255, 0.6)' }}>
                        Coordinates
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {locationAnalytics.map((loc, idx) => (
                      <tr
                        key={`loc-${idx}`}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          backgroundColor: idx % 2 === 0 ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#60a5fa', fontWeight: '600' }}>
                          #{loc.rank}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#e0e0e0' }}>
                          {loc.location}
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', color: '#10b981', fontWeight: '600', textAlign: 'right' }}>
                          ${(loc.revenue / 1000).toFixed(1)}K
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px', textAlign: 'right' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: '8px',
                            }}
                          >
                            <div
                              style={{
                                width: '60px',
                                height: '20px',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                borderRadius: '4px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${loc.revenuePercent}%`,
                                  height: '100%',
                                  backgroundColor: loc.rank === 1 ? '#fbbf24' : loc.rank <= 2 ? '#60a5fa' : '#34d399',
                                  transition: 'width 0.3s ease',
                                }}
                              />
                            </div>
                            <span style={{ color: 'rgba(255, 255, 255, 0.7)', width: '30px', textAlign: 'right' }}>
                              {loc.revenuePercent.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Revenue Distribution */}
              <div style={{ marginTop: '16px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>
                  Revenue Distribution by Location
                </h3>
                <div style={{ ...cardStyle, padding: '20px', minHeight: '300px' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={locationAnalytics.map(loc => ({ name: loc.location, value: parseFloat((loc.revenue / 1000).toFixed(1)) }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name }) => name}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {COLORS.map((color, index) => (
                          <Cell key={`cell-${index}`} fill={color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${value}K`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
      </main>
    </div>
  )
}

export default DashboardPage
