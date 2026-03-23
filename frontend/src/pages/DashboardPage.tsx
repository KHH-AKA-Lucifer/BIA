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

type TabType = 'executive' | 'machines' | 'geographic'

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth()
  const { data, loading, error, refresh } = useDashboard()

  const [activeTab, setActiveTab] = React.useState<TabType>('executive')

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

            {/* Statistical Analysis Section */}
            {stats && (
              <div
                style={{
                  marginTop: '18px',
                }}
              >
                <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#fff', margin: '0 0 12px 0' }}>
                  Statistical Analysis
                </h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: '12px',
                  }}
                >
                  {/* Central Tendency */}
                  <div style={{ ...cardStyle, padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '10px', textTransform: 'uppercase', fontWeight: '600' }}>
                      Central Tendency
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>Mean</span>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#60a5fa' }}>{stats.mean}%</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>Median</span>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#a78bfa' }}>{stats.median}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Dispersion */}
                  <div style={{ ...cardStyle, padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '10px', textTransform: 'uppercase', fontWeight: '600' }}>
                      Dispersion
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>Std Dev</span>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: '#fbbf24' }}>{stats.stdDev}%</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>CV</span>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#fb923c' }}>{stats.cv}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Range & Extremes */}
                  <div style={{ ...cardStyle, padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '10px', textTransform: 'uppercase', fontWeight: '600' }}>
                      Range
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>Min - Max</span>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#34d399' }}>{stats.min}% - {stats.max}%</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>Span</span>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#22c55e' }}>{stats.range}%</div>
                      </div>
                    </div>
                  </div>

                  {/* Quartiles */}
                  <div style={{ ...cardStyle, padding: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '10px', textTransform: 'uppercase', fontWeight: '600' }}>
                      Quartiles
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>
                        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>Q1 | Q3</span>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#a1e8af' }}>{stats.q1}% | {stats.q3}%</div>
                      </div>
                      <div>
                        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>IQR</span>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#91d5ff' }}>{stats.iqr}%</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quartile Distribution */}
                <div style={{ ...cardStyle, padding: '14px', marginTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '10px' }}>
                    Quartile Distribution
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                    {[
                      { label: 'Q1 (Bottom)', count: stats.q1Count, color: '#ef4444', range: `< ${stats.q1}%` },
                      { label: 'Q2 (Lower)', count: stats.q2Count, color: '#f97316', range: `${stats.q1}% - ${stats.median}%` },
                      { label: 'Q3 (Upper)', count: stats.q3Count, color: '#eab308', range: `${stats.median}% - ${stats.q3}%` },
                      { label: 'Q4 (Top)', count: stats.q4Count, color: '#22c55e', range: `> ${stats.q3}%` },
                    ].map((q, i) => (
                      <div key={`q-${i}`} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)' }}>{q.label}</div>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: q.color, margin: '4px 0' }}>{q.count}</div>
                        <div style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)' }}>{q.range}</div>
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
      </main>
    </div>
  )
}

export default DashboardPage
