import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../hooks/useDashboard'
import KPICard from '../components/KPICard'
import { LogOut, RefreshCw } from 'lucide-react'

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { data, loading, error, refresh } = useDashboard()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const totalRevenue = data
    ? Object.values(data.revenue_by_category).reduce((sum, val) => sum + val, 0)
    : 0

  const machineCount = data ? Object.keys(data.top_locations).length : 0
  const alertCount = data ? data.alerts.length : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">BIA Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={refresh}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <span className="text-gray-700 text-sm">{user?.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
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
            value={`${(Number(data?.machine_utilization) || 0).toFixed(1)}%`}
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

        {/* Revenue by Category */}
        {data && data.revenue_by_category && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Revenue by Category</h2>
            <div className="space-y-3">
              {Object.entries(data.revenue_by_category).map(([category, revenue]) => (
                <div key={category} className="flex justify-between items-center">
                  <span className="text-gray-600 capitalize">{category}</span>
                  <span className="font-semibold text-gray-900">${(revenue / 1000).toFixed(1)}K</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Locations */}
        {data && data.top_locations && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Top Performing Locations</h2>
            <div className="space-y-3">
              {Object.entries(data.top_locations)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([location, revenue]) => (
                  <div key={location} className="flex justify-between items-center">
                    <span className="text-gray-600">{location}</span>
                    <span className="font-semibold text-gray-900">${(revenue / 1000).toFixed(1)}K</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default DashboardPage
