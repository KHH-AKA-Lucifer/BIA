import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../hooks/useDashboard'
import KPICard from '../components/KPICard'
import { LogOut, RefreshCw, TrendingUp, MapPin } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useDashboard()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const totalRevenue = data
    ? data.revenue_by_category.values.reduce((sum: number, val: number) => sum + val, 0)
    : 0

  const machineCount = data ? Object.keys(data.machine_utilization).length : 0
  const avgMachineUtilization = data
    ? Object.values(data.machine_utilization).reduce((sum: number, val: number) => sum + val, 0) / Math.max(Object.keys(data.machine_utilization).length, 1)
    : 0
  const alertCount = data ? data.alerts.length : 0

  // Prepare revenue chart data
  const revenueChartData = data
    ? data.revenue_by_category.labels.map((label: string, idx: number) => ({
        name: label,
        revenue: data.revenue_by_category.values[idx] / 1000,
      }))
    : []

  // Prepare top locations data
  const topLocationsData = data
    ? Object.entries(data.top_locations)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([location, revenue]) => ({
          location,
          revenue: (revenue as number) / 1000,
        }))
    : []

  const navbarStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
  }

  const contentStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, #0f3460 0%, #1a1a2e 100%)',
    minHeight: '100vh',
  }

  const cardStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.3s ease',
  }

  const [hoveredCard, setHoveredCard] = React.useState<string | null>(null)

  return (
    <div style={contentStyle}>
      {/* Navbar */}
      <nav style={navbarStyle}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '64px' }}>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#fff', margin: 0 }}>BIA Dashboard</h1>
              <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', margin: '4px 0 0 0' }}>
                Vending Machine Intelligence
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={refresh}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  opacity: loading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>{user?.email}</span>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#fecaca',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                }}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 16px' }}>
        {error && (
          <div
            style={{
              marginBottom: '32px',
              padding: '16px 20px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              color: '#fecaca',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {/* KPI Cards Section */}
        <div style={{ marginBottom: '56px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#fff', marginBottom: '24px' }}>Key Metrics</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '24px',
            }}
          >
            <KPICard
              title="Total Revenue"
              value={`$${(totalRevenue / 1000).toFixed(1)}K`}
              unit="USD"
              icon="revenue"
              loading={loading}
              trend="up"
              trendValue="+12.5%"
            />
            <KPICard
              title="Active Machines"
              value={machineCount}
              icon="machines"
              loading={loading}
              trend="up"
              trendValue="+2"
            />
            <KPICard
              title="Avg Machine Utilization"
              value={`${avgMachineUtilization.toFixed(1)}%`}
              icon="utilization"
              loading={loading}
              trend="up"
              trendValue="+5.2%"
            />
            <KPICard
              title="Active Alerts"
              value={alertCount}
              icon="alerts"
              loading={loading}
              trend={alertCount > 0 ? 'down' : 'neutral'}
              trendValue={alertCount > 0 ? '-3' : 'No change'}
            />
          </div>
        </div>

        {/* Charts & Analytics Section */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '32px',
          }}
        >
          {/* Revenue by Category */}
          {data && revenueChartData.length > 0 && (
            <div
              style={{
                ...cardStyle,
                padding: '32px',
              }}
              onMouseEnter={() => setHoveredCard('revenue')}
              onMouseLeave={() => setHoveredCard(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: 'rgba(96, 165, 250, 0.15)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TrendingUp style={{ color: '#60a5fa', width: '20px', height: '20px' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>Revenue by Category</h3>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={revenueChartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
                  <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.5)" style={{ fontSize: '12px' }} />
                  <YAxis stroke="rgba(255, 255, 255, 0.5)" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(26, 26, 46, 0.95)',
                      border: '1px solid rgba(96, 165, 250, 0.3)',
                      borderRadius: '10px',
                      color: '#fff',
                      padding: '12px',
                    }}
                    formatter={(value) => `$${(value as number).toFixed(1)}K`}
                    cursor={{ fill: 'rgba(96, 165, 250, 0.1)' }}
                  />
                  <Bar dataKey="revenue" fill="#60a5fa" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Summary Stats Card */}
          <div
            style={{
              ...cardStyle,
              padding: '32px',
            }}
            onMouseEnter={() => setHoveredCard('summary')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', marginBottom: '28px', margin: 0 }}>Performance Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {data && data.revenue_by_category && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>Product Categories</span>
                    <span style={{ fontSize: '16px', fontWeight: '600', color: '#60a5fa' }}>
                      {data.revenue_by_category.labels.length}
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        backgroundColor: '#60a5fa',
                        width: '100%',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                </div>
              )}

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>Machine Utilization</span>
                  <span style={{ fontSize: '16px', fontWeight: '600', color: '#34d399' }}>
                    {avgMachineUtilization.toFixed(1)}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      backgroundColor: '#34d399',
                      width: `${Math.min(avgMachineUtilization, 100)}%`,
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>System Health</span>
                  <span style={{ fontSize: '16px', fontWeight: '600', color: alertCount > 0 ? '#f87171' : '#34d399' }}>
                    {alertCount > 0 ? `${alertCount} Issues` : 'Excellent'}
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      backgroundColor: alertCount > 0 ? '#f87171' : '#34d399',
                      width: alertCount > 0 ? '40%' : '100%',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Locations Table */}
        {data && topLocationsData.length > 0 && (
          <div
            style={{
              ...cardStyle,
              padding: '32px',
            }}
            onMouseEnter={() => setHoveredCard('locations')}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: 'rgba(244, 114, 182, 0.15)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MapPin style={{ color: '#f472b6', width: '20px', height: '20px' }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#fff', margin: 0 }}>Top Performing Locations</h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <th
                      style={{
                        textAlign: 'left',
                        padding: '14px 0',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Location
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '14px 0',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Revenue
                    </th>
                    <th
                      style={{
                        textAlign: 'right',
                        padding: '14px 0',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '12px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Rank
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topLocationsData.map((item, index) => (
                    <tr
                      key={item.location}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        transition: 'all 0.3s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      <td
                        style={{
                          padding: '16px 0',
                          color: '#fff',
                          fontSize: '14px',
                          fontWeight: '500',
                        }}
                      >
                        {item.location}
                      </td>
                      <td
                        style={{
                          padding: '16px 0',
                          textAlign: 'right',
                          color: '#60a5fa',
                          fontSize: '14px',
                          fontWeight: '600',
                        }}
                      >
                        ${item.revenue.toFixed(1)}K
                      </td>
                      <td
                        style={{
                          padding: '16px 0',
                          textAlign: 'right',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '6px 12px',
                            backgroundColor: [
                              'rgba(245, 158, 11, 0.15)',
                              'rgba(168, 85, 247, 0.15)',
                              'rgba(59, 130, 246, 0.15)',
                              'rgba(34, 197, 94, 0.15)',
                              'rgba(239, 68, 68, 0.15)',
                            ][index],
                            color: [
                              '#fbbf24',
                              '#d8b4fe',
                              '#93c5fd',
                              '#86efac',
                              '#fecaca',
                            ][index],
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: '600',
                          }}
                        >
                          #{index + 1}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default DashboardPage
