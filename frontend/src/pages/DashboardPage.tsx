import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../hooks/useDashboard'
import BIAssistant from '../components/BIAssistant'
import KPICard from '../components/KPICard'
import { LocationMap } from '../components/LocationMap'
import type {
  DashboardFilters,
  DashboardPeriod,
  DashboardTab,
  RestockPriorityItem,
  SubcategoryRanking,
} from '../types/dashboard.types'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import {
  Boxes,
  CalendarRange,
  ClipboardList,
  Compass,
  LineChart as LineChartIcon,
  LogOut,
  Map,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

type SortDirection = 'asc' | 'desc'

interface SortState<T extends string> {
  key: T
  direction: SortDirection
}

const DISPLAY_DEPTH = 8
const MATRIX_DEPTH = 12

const TABS: Array<{ id: DashboardTab; label: string; icon: React.ReactNode }> = [
  { id: 'executive', label: 'Executive', icon: <LineChartIcon size={16} /> },
  { id: 'products', label: 'Products', icon: <Boxes size={16} /> },
  { id: 'locations', label: 'Locations', icon: <Map size={16} /> },
  { id: 'operations', label: 'Operations', icon: <ClipboardList size={16} /> },
  { id: 'forecast', label: 'AI Assistant', icon: <Compass size={16} /> },
]

const PERIOD_OPTIONS: DashboardPeriod[] = ['week', 'month', 'quarter', 'year']
const CATEGORY_COLORS = ['#0F766E', '#1D4ED8', '#B45309', '#9333EA', '#BE123C', '#0EA5E9', '#7C3AED', '#16A34A']
const STATUS_COLORS = { healthy: '#16A34A', warning: '#D97706', critical: '#DC2626' }
const TABULAR_FONT = '"IBM Plex Sans", "Inter", "Segoe UI", sans-serif'
const currency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value >= 1000 ? 0 : 2 }).format(value)

const compactCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)

const percent = (value: number) => `${value.toFixed(1)}%`

const statusColor = (status: string) => STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? '#475569'

const statusBackground = (status: string) => {
  if (status === 'healthy') return '#ECFDF3'
  if (status === 'warning') return '#FFF7ED'
  return '#FEF2F2'
}

function nextDirection<T extends string>(state: SortState<T>, key: T): SortState<T> {
  if (state.key !== key) return { key, direction: 'desc' }
  return { key, direction: state.direction === 'desc' ? 'asc' : 'desc' }
}

function sortRows<T extends Record<string, any>, K extends Extract<keyof T, string>>(rows: T[], sort: SortState<K>): T[] {
  const multiplier = sort.direction === 'desc' ? -1 : 1
  return [...rows].sort((left, right) => {
    const a = left[sort.key]
    const b = right[sort.key]
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * multiplier
    return String(a).localeCompare(String(b)) * multiplier
  })
}

const pageShell: React.CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #F5F7FB 0%, #EEF4F8 100%)',
  color: '#0F172A',
  fontFamily: TABULAR_FONT,
  position: 'relative',
  isolation: 'isolate',
}

const cardShell: React.CSSProperties = {
  background: '#FFFFFF',
  borderRadius: '24px',
  border: '1px solid #DCE5EF',
  padding: '24px',
  boxShadow: '0 14px 36px rgba(15, 23, 42, 0.07)',
}

const tableHeader = (align: 'left' | 'right' = 'left'): React.CSSProperties => ({
  padding: '12px 10px',
  fontSize: '12px',
  color: '#64748B',
  textTransform: 'uppercase',
  textAlign: align,
  cursor: 'pointer',
  letterSpacing: '0.04em',
})

const SectionCard: React.FC<React.PropsWithChildren<{ title: string; subtitle?: string; actions?: React.ReactNode }>> = ({
  title,
  subtitle,
  actions,
  children,
}) => (
  <section style={cardShell}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', marginBottom: '18px', flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ fontSize: '24px', lineHeight: 1.15, fontWeight: 900, color: '#0F172A', margin: 0 }}>{title}</h2>
        {subtitle ? <p style={{ fontSize: '14px', color: '#475569', margin: '8px 0 0 0', lineHeight: 1.6 }}>{subtitle}</p> : null}
      </div>
      {actions}
    </div>
    {children}
  </section>
)

const MetricChip: React.FC<{ label: string; value: string; tone?: 'neutral' | 'success' | 'warning' }> = ({ label, value, tone = 'neutral' }) => {
  const toneStyles = {
    neutral: { bg: '#EFF6FF', fg: '#1D4ED8', border: '#BFDBFE' },
    success: { bg: '#ECFDF3', fg: '#166534', border: '#BBF7D0' },
    warning: { bg: '#FFF7ED', fg: '#9A3412', border: '#FED7AA' },
  }[tone]

  return (
    <div style={{ padding: '14px 16px', borderRadius: '16px', background: toneStyles.bg, border: `1px solid ${toneStyles.border}` }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: toneStyles.fg, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: '8px', fontSize: '26px', fontWeight: 900, color: '#0F172A' }}>{value}</div>
    </div>
  )
}

const DashboardPage: React.FC = () => {
  const { logout } = useAuth()
  const [period, setPeriod] = React.useState<DashboardPeriod>('month')
  const [activeTab, setActiveTab] = React.useState<DashboardTab>('executive')
  const [filters, setFilters] = React.useState<DashboardFilters>({})
  const [subcategorySort, setSubcategorySort] = React.useState<SortState<keyof SubcategoryRanking>>({ key: 'revenue', direction: 'desc' })
  const [restockSort, setRestockSort] = React.useState<SortState<keyof RestockPriorityItem>>({ key: 'risk_score', direction: 'desc' })

  const { data, loading, error, refresh } = useDashboard(period, filters)

  const sortedSubcategories = React.useMemo(() => (data ? sortRows(data.subcategory_rankings, subcategorySort) : []), [data, subcategorySort])
  const sortedMachines = data?.machine_rankings ?? []
  const sortedRestock = React.useMemo(() => (data ? sortRows(data.restock_priority, restockSort) : []), [data, restockSort])

  const updateFilters = React.useCallback((updates: Partial<DashboardFilters>) => {
    setFilters((previous) => {
      const next: DashboardFilters = { ...previous }
      Object.entries(updates).forEach(([key, value]) => {
        const typedKey = key as keyof DashboardFilters
        if (value === undefined || value === null || value === '') {
          delete next[typedKey]
        } else {
          next[typedKey] = value as never
        }
      })
      return next
    })
  }, [])

  const clearAllFilters = React.useCallback(() => setFilters({}), [])
  const clearFilter = React.useCallback((key: keyof DashboardFilters) => {
    setFilters((previous) => {
      const next = { ...previous }
      delete next[key]
      if (key === 'category') {
        delete next.subcategory
        delete next.product
      }
      if (key === 'subcategory') {
        delete next.product
      }
      return next
    })
  }, [])

  const selectLocation = React.useCallback((location: string) => {
    if (filters.location === location) {
      updateFilters({ location: undefined, machine_id: undefined })
      return
    }
    updateFilters({ location, machine_id: undefined })
  }, [filters.location, updateFilters])

  const selectCategory = React.useCallback((category: string) => {
    if (filters.category === category && !filters.subcategory && !filters.product) {
      updateFilters({ category: undefined, subcategory: undefined, product: undefined })
      return
    }
    updateFilters({ category, subcategory: undefined, product: undefined })
  }, [filters.category, filters.product, filters.subcategory, updateFilters])

  const selectSubcategory = React.useCallback((category: string, subcategory: string) => {
    if (filters.category === category && filters.subcategory === subcategory && !filters.product) {
      updateFilters({ category: undefined, subcategory: undefined, product: undefined })
      return
    }
    updateFilters({ category, subcategory, product: undefined })
  }, [filters.category, filters.product, filters.subcategory, updateFilters])

  const selectProduct = React.useCallback((category: string, subcategory: string, product: string) => {
    if (filters.category === category && filters.subcategory === subcategory && filters.product === product) {
      updateFilters({ category: undefined, subcategory: undefined, product: undefined })
      return
    }
    updateFilters({ category, subcategory, product })
  }, [filters.category, filters.product, filters.subcategory, updateFilters])

  const selectMachine = React.useCallback((machine_id: string) => {
    if (filters.machine_id === machine_id) {
      updateFilters({ machine_id: undefined })
      return
    }
    updateFilters({ machine_id })
  }, [filters.machine_id, updateFilters])

  const selectWeekday = React.useCallback((weekday_index: number) => {
    if (filters.weekday_index === weekday_index) {
      updateFilters({ weekday_index: undefined })
      return
    }
    updateFilters({ weekday_index })
  }, [filters.weekday_index, updateFilters])

  const selectHour = React.useCallback((hour: number) => {
    if (filters.hour === hour) {
      updateFilters({ hour: undefined })
      return
    }
    updateFilters({ hour })
  }, [filters.hour, updateFilters])

  const selectPaymentType = React.useCallback((payment_type: string) => {
    if (filters.payment_type === payment_type) {
      updateFilters({ payment_type: undefined })
      return
    }
    updateFilters({ payment_type })
  }, [filters.payment_type, updateFilters])

  const topLocationBars = data?.location_rankings.slice(0, DISPLAY_DEPTH).map((item) => ({
    name: item.name,
    displayName: item.name.length > 20 ? `${item.name.slice(0, 20)}...` : item.name,
    revenue: Number(item.revenue.toFixed(0)),
    share: item.share,
  })) ?? []

  const topCategoryBars = data?.category_rankings.slice(0, DISPLAY_DEPTH).map((item) => ({
    name: item.name,
    revenue: Number(item.revenue.toFixed(0)),
  })) ?? []

  const topProductBars = data?.product_rankings.slice(0, DISPLAY_DEPTH).map((item) => ({
    name: item.name,
    displayName: item.name.length > 26 ? `${item.name.slice(0, 26)}...` : item.name,
    revenue: Number(item.revenue.toFixed(0)),
    category: item.category,
    subcategory: item.subcategory,
  })) ?? []

  const categoryBridgeRows = data?.category_product_bridge ?? []
  const contributionRows = data?.category_subcategory_contribution ?? []
  const selectedCategoryBridge = categoryBridgeRows[0] ?? null
  const selectedContributionRow = contributionRows[0] ?? null

  const leadingCategoryProductBars = selectedCategoryBridge?.drivers.slice(0, DISPLAY_DEPTH).map((item) => ({
    name: item.product,
    displayName: item.product.length > 28 ? `${item.product.slice(0, 28)}...` : item.product,
    revenue: Number(item.revenue.toFixed(0)),
    share_of_category: item.share_of_category,
    subcategory: item.subcategory,
    global_product_rank: item.global_product_rank,
  })) ?? []
  const categoryConcentrationBars = categoryBridgeRows.slice(0, DISPLAY_DEPTH).map((row) => {
    const topThreeShare = row.drivers.slice(0, 3).reduce((sum, item) => sum + item.share_of_category, 0)
    return {
      category: row.category,
      displayName: row.category.length > 22 ? `${row.category.slice(0, 22)}...` : row.category,
      top_three_share: Number(topThreeShare.toFixed(1)),
      remaining_share: Number(Math.max(0, 100 - topThreeShare).toFixed(1)),
      product_count: row.product_count,
    }
  })
  const selectedSubcategoryBars = selectedContributionRow?.subcategories.slice(0, DISPLAY_DEPTH).map((slice) => ({
    name: slice.subcategory,
    displayName: slice.subcategory.length > 24 ? `${slice.subcategory.slice(0, 24)}...` : slice.subcategory,
    revenue: Number(slice.revenue.toFixed(0)),
    share_of_category: slice.share_of_category,
  })) ?? []
  const hierarchyRows = data?.product_hierarchy_matrix.slice(0, MATRIX_DEPTH) ?? []

  const revenueTrendData = data?.revenue_series ?? []
  const weekdayMetricData = data?.weekday_demand ?? []
  const hourlyMetricData = data?.hourly_demand ?? []

  const focusLocationSummary = data?.location_rankings[0] ?? null
  const focusLocationMix = data?.category_location_matrix[0] ?? null
  const focusLocationTopCategories = [...(focusLocationMix?.categories ?? [])].sort((left, right) => right.revenue - left.revenue).slice(0, 4)
  const locationDependencyBars = (data?.category_location_matrix ?? []).slice(0, DISPLAY_DEPTH).map((row) => {
    const strongest = [...row.categories].sort((left, right) => right.share_of_location - left.share_of_location)[0]
    return {
      location: row.location,
      displayName: row.location.length > 22 ? `${row.location.slice(0, 22)}...` : row.location,
      strongest_share: Number((strongest?.share_of_location ?? 0).toFixed(1)),
      remaining_share: Number((100 - (strongest?.share_of_location ?? 0)).toFixed(1)),
      strongest_category: strongest?.category ?? 'N/A',
    }
  })

  const focusMachineSummary = data?.machine_rankings[0] ?? null
  const focusMachineQueue = data?.restock_priority.find((row) => row.machine_id === focusMachineSummary?.machine_id) ?? null
  const machineScatterData = sortedMachines.slice(0, 16).map((row) => ({
    machine_id: row.machine_id,
    location: row.location,
    revenue: row.revenue,
    utilization: row.utilization,
    risk_score: sortedRestock.find((item) => item.machine_id === row.machine_id)?.risk_score ?? 0,
    status: row.status,
  }))

  const paymentPie = data?.payment_mix ?? []
  const statusPie = data ? [
    { name: 'Healthy', value: data.status_summary.healthy, fill: STATUS_COLORS.healthy },
    { name: 'Warning', value: data.status_summary.warning, fill: STATUS_COLORS.warning },
    { name: 'Critical', value: data.status_summary.critical, fill: STATUS_COLORS.critical },
  ] : []
  const riskBars = sortedRestock.slice(0, 8).map((item) => ({
    machine: item.machine_id,
    risk: item.risk_score,
  }))
  const activeFilters = React.useMemo(
    () =>
      [
        filters.location ? { key: 'location' as const, label: `Location: ${filters.location}` } : null,
        filters.category ? { key: 'category' as const, label: `Category: ${filters.category}` } : null,
        filters.subcategory ? { key: 'subcategory' as const, label: `Subcategory: ${filters.subcategory}` } : null,
        filters.product ? { key: 'product' as const, label: `Product: ${filters.product}` } : null,
        filters.machine_id ? { key: 'machine_id' as const, label: `Machine: ${filters.machine_id}` } : null,
        filters.weekday_index !== undefined ? { key: 'weekday_index' as const, label: `Weekday: ${weekdayMetricData[filters.weekday_index]?.label ?? filters.weekday_index}` } : null,
        filters.hour !== undefined ? { key: 'hour' as const, label: `Hour: ${String(filters.hour).padStart(2, '0')}:00` } : null,
        filters.payment_type ? { key: 'payment_type' as const, label: `Payment: ${filters.payment_type}` } : null,
      ].filter(Boolean) as Array<{ key: keyof DashboardFilters; label: string }>,
    [filters, weekdayMetricData],
  )

  const renderExecutiveTab = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '24px' }}>
        <KPICard eyebrow="Revenue" title="Period Revenue" value={currency(data!.kpis.total_revenue)} supporting={`${data!.kpis.total_transactions.toLocaleString()} transactions across ${data!.kpis.total_machines} machines`} icon="revenue" tone="positive" />
        <KPICard eyebrow="Location" title="Top Performing Location" value={data!.kpis.top_location.name} supporting={`${currency(data!.kpis.top_location.revenue)} | ${percent(data!.kpis.top_location.share)} share`} icon="location" tone="neutral" />
        <KPICard eyebrow="Category" title="Top Performing Category" value={data!.kpis.top_category.name} supporting={`${currency(data!.kpis.top_category.revenue)} | ${percent(data!.kpis.top_category.share)} share`} icon="category" tone="neutral" />
        <KPICard eyebrow="Subcategory" title="Top Performing Subcategory" value={data!.kpis.top_subcategory.name} supporting={`${currency(data!.kpis.top_subcategory.revenue)} | ${percent(data!.kpis.top_subcategory.share)} share`} icon="category" tone="neutral" />
        <KPICard eyebrow="Product" title="Top Performing Product" value={data!.kpis.top_product.name} supporting={`${currency(data!.kpis.top_product.revenue)} | ${percent(data!.kpis.top_product.share)} share`} icon="product" tone="positive" />
        <KPICard eyebrow="Attention" title="Priority Machines" value={String(data!.kpis.attention_machines)} supporting={`Based on the operational snapshot from ${data!.operational_range.start} to ${data!.operational_range.end}.`} icon="attention" tone="warning" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.75fr) minmax(320px, 0.95fr)', gap: '20px', marginBottom: '24px' }}>
        <SectionCard
          title="Revenue Trend"
          subtitle="The primary performance trend uses a consistent rolling analytical window: week = last 7 days, month = last 30 days, quarter = last 90 days, and year = last 365 days."
        >
          <div style={{ height: '380px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrendData} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(Number(value))} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 16, border: '1px solid #CBD5E1', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#1D4ED8" strokeWidth={3} fill="url(#revenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Executive Priorities"
          subtitle={`These actions come from the current operational snapshot (${data!.operational_range.start} to ${data!.operational_range.end}), not the selected analytical period.`}
          actions={<Sparkles size={18} color="#1D4ED8" />}
        >
          <div style={{ display: 'grid', gap: '14px' }}>
            {data!.action_items.map((item) => (
              <article key={item.title} style={{ padding: '18px', borderRadius: '18px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: '999px', background: item.priority === 'Critical' ? '#FEF2F2' : item.priority === 'High' ? '#FFF7ED' : '#EFF6FF', color: item.priority === 'Critical' ? '#B91C1C' : item.priority === 'High' ? '#9A3412' : '#1D4ED8', fontSize: '12px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {item.priority}
                </div>
                <h3 style={{ margin: '12px 0 8px 0', fontSize: '18px', lineHeight: 1.3, color: '#0F172A' }}>{item.title}</h3>
                <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: 1.6 }}>{item.detail}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <SectionCard title="Weekday Performance" subtitle="This view highlights the recurring business rhythm behind peak and weak trading periods.">
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekdayMetricData} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(Number(value))} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip formatter={(value: any, _name: any, entry: any) => [currency(Number(value)), `Click to filter ${entry?.payload?.label ?? ''}`]} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]} onClick={(payload: any) => selectWeekday(Number(payload.day_index))} style={{ cursor: 'pointer' }}>
                  {weekdayMetricData.map((_, index) => <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Hourly Demand Profile" subtitle="This supports peak-hour staffing and replenishment planning inside the current analysis window.">
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={hourlyMetricData} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F766E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0F766E" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} minTickGap={16} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(Number(value))} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip formatter={(value: any, _name: any, entry: any) => [currency(Number(value)), `Hour ${entry?.payload?.label ?? ''}`]} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Area type="monotone" dataKey="revenue" stroke="#0F766E" strokeWidth={3} fill="url(#hourFill)" onClick={(payload: any) => selectHour(Number(payload.hour))} style={{ cursor: 'pointer' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Payment Mix" subtitle="Payment mix supports transaction behavior analysis and machine interface planning.">
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentPie} dataKey="revenue" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={4} onClick={(payload: any) => selectPaymentType(String(payload?.name ?? payload?.payload?.name ?? ''))} style={{ cursor: 'pointer' }}>
                  {paymentPie.map((entry, index) => <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </>
  )

  const renderProductsTab = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <SectionCard title="Category Revenue Ranking" subtitle="This is the portfolio view: which product families generate the most revenue across the selected period.">
          <div style={{ height: '340px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCategoryBars} layout="vertical" margin={{ top: 8, right: 18, left: 40, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="displayName" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={160} />
                <Tooltip formatter={(value: any, _name: any, entry: any) => [currency(Number(value)), `Click to filter ${entry?.payload?.name ?? ''}`]} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]} onClick={(payload: any) => selectCategory(String(payload.name))} style={{ cursor: 'pointer' }}>
                  {topCategoryBars.map((item, index) => <Cell key={index} fill={item.name === filters.category ? '#1D4ED8' : CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Category Concentration Risk"
          subtitle="This chart separates broad categories from fragile ones. A lower top-three share means the category is supported by a wider assortment rather than a few products."
        >
          <div style={{ height: '340px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryConcentrationBars} layout="vertical" margin={{ top: 8, right: 24, left: 82, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => `${value}%`} domain={[0, 100]} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="displayName" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={190} />
                <Tooltip
                  formatter={(value: any, _name: any, entry: any) => {
                    return [`${Number(value).toFixed(1)}%`, `${entry?.payload?.product_count ?? 0} products in category`]
                  }}
                  labelFormatter={(_label: any, payload: any) => `Category: ${payload?.[0]?.payload?.category ?? ''}`}
                  contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }}
                />
                <Legend />
                <Bar dataKey="top_three_share" stackId="concentration" fill="#0F766E" radius={[0, 0, 0, 0]} onClick={(payload: any) => selectCategory(String(payload.category))} style={{ cursor: 'pointer' }} />
                <Bar dataKey="remaining_share" stackId="concentration" fill="#D1FAE5" radius={[0, 8, 8, 0]} onClick={(payload: any) => selectCategory(String(payload.category))} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)', gap: '20px', marginBottom: '24px' }}>
        <SectionCard
          title={selectedCategoryBridge ? `Products Driving ${selectedCategoryBridge.category}` : 'Category Product Drivers'}
          subtitle={
            selectedCategoryBridge
              ? `${selectedCategoryBridge.category} leads through these revenue drivers. This is a within-category view, not a global product leaderboard.`
              : 'This view shows the strongest products inside the selected category.'
          }
        >
          <div style={{ height: '380px', marginBottom: '18px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leadingCategoryProductBars} layout="vertical" margin={{ top: 8, right: 18, left: 110, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="displayName" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={190} />
                <Tooltip
                  formatter={(value: any, _name: any, entry: any) => [currency(Number(value)), `${Number(entry?.payload?.share_of_category ?? 0).toFixed(1)}% of category | ${entry?.payload?.subcategory ?? ''}`]}
                  contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }}
                />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]} onClick={(payload: any) => selectProduct(selectedCategoryBridge?.category ?? '', String(payload.subcategory ?? ''), String(payload.name))} style={{ cursor: 'pointer' }}>
                  {leadingCategoryProductBars.map((_, index) => <Cell key={index} fill={index === 0 ? '#0F766E' : '#6EE7B7'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '280px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  {[
                    ['name', 'Product', 'left'],
                    ['subcategory', 'Subcategory', 'left'],
                    ['revenue', 'Revenue', 'right'],
                    ['share_of_category', 'Share Of Category', 'right'],
                    ['global_product_rank', 'Global Rank', 'right'],
                    ['transactions', 'Transactions', 'right'],
                  ].map(([key, label, align]) => (
                    <th key={key} style={tableHeader(align as 'left' | 'right')}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedCategoryBridge?.drivers.slice(0, DISPLAY_DEPTH).map((row) => (
                  <tr key={row.product} style={{ borderBottom: '1px solid #EEF2F7', cursor: 'pointer' }} onClick={() => selectProduct(selectedCategoryBridge?.category ?? '', row.subcategory, row.product)}>
                    <td style={{ padding: '12px 10px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.product}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#475569' }}>{row.subcategory}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#0F766E', textAlign: 'right' }}>{currency(row.revenue)}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>{percent(row.share_of_category)}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>{row.global_product_rank || '-'}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>{row.transactions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title={selectedContributionRow ? `Subcategory Mix Within ${selectedContributionRow.category}` : 'Subcategory Mix'}
          subtitle={
            selectedContributionRow
              ? `This view stays inside ${selectedContributionRow.category} and shows which subcategories are carrying the category. It complements the product-driver chart by moving one level up the hierarchy.`
              : 'This view shows which subcategories are driving the selected category.'
          }
        >
          <div style={{ height: '380px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={selectedSubcategoryBars} layout="vertical" margin={{ top: 8, right: 18, left: 72, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="displayName" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={170} />
                <Tooltip formatter={(value: any, _name: any, entry: any) => [currency(Number(value)), `${Number(entry?.payload?.share_of_category ?? 0).toFixed(1)}% of category`]} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]} onClick={(payload: any) => selectSubcategory(selectedContributionRow?.category ?? '', String(payload.name))} style={{ cursor: 'pointer' }}>
                  {selectedSubcategoryBars.map((_, index) => <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.95fr)', gap: '20px', marginBottom: '24px' }}>
        <SectionCard title="Global Product Revenue Ranking" subtitle="This is the cross-category leaderboard. It stays separate from the focused category view so you can compare portfolio winners against in-category drivers.">
          <div style={{ height: '360px', marginBottom: '18px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductBars} layout="vertical" margin={{ top: 8, right: 18, left: 110, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="displayName" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={190} />
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]} onClick={(payload: any) => selectProduct(String(payload.category), String(payload.subcategory), String(payload.name))} style={{ cursor: 'pointer' }}>
                  {topProductBars.map((item, index) => (
                    <Cell key={index} fill={item.category === filters.category ? '#0F766E' : index === 0 ? '#1D4ED8' : '#60A5FA'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ padding: '14px 16px', borderRadius: '18px', background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155', fontSize: '14px', lineHeight: 1.6 }}>
            Selected category <strong>{filters.category ?? 'None'}</strong> is highlighted in green. Click any category, subcategory, or product view to slice the entire dashboard.
          </div>
        </SectionCard>

        <SectionCard title="Category / Product Bridge" subtitle="This compact comparison explains why the selected category is strong and whether that strength comes from breadth or from a few leading products.">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <th style={tableHeader('left')}>Category</th>
                  <th style={tableHeader('right')}>Revenue</th>
                  <th style={tableHeader('left')}>Top Product</th>
                  <th style={tableHeader('right')}>Top Product Share</th>
                  <th style={tableHeader('right')}>Products In Top 15</th>
                </tr>
              </thead>
              <tbody>
                {categoryBridgeRows.slice(0, 5).map((row) => (
                  <tr key={row.category} style={{ borderBottom: '1px solid #EEF2F7', background: row.category === filters.category ? '#F0FDFA' : 'transparent', cursor: 'pointer' }} onClick={() => selectCategory(row.category)}>
                    <td style={{ padding: '12px 10px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.category}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#0F766E', textAlign: 'right' }}>{currency(row.total_revenue)}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#334155' }}>{row.top_product}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>{percent(row.top_product_share_of_category)}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>{row.products_in_global_top}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Merchandise Hierarchy Matrix" subtitle="This matrix ties category, subcategory, and product into one audit view. Use it to defend assortment decisions without switching between separate tables.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <th style={tableHeader('left')}>Category</th>
                <th style={tableHeader('left')}>Subcategory</th>
                <th style={tableHeader('left')}>Product</th>
                <th style={tableHeader('right')}>Revenue</th>
                <th style={tableHeader('right')}>Share Of Category</th>
                <th style={tableHeader('right')}>Rank In Category</th>
              </tr>
            </thead>
            <tbody>
              {hierarchyRows.map((row) => (
                <tr key={`${row.category}-${row.product}`} style={{ borderBottom: '1px solid #EEF2F7', cursor: 'pointer' }} onClick={() => selectProduct(row.category, row.subcategory, row.product)}>
                  <td style={{ padding: '12px 10px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.category}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', color: '#475569' }}>{row.subcategory}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', color: '#334155' }}>{row.product}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right' }}>
                    <span style={{ display: 'inline-block', minWidth: '96px', padding: '8px 10px', borderRadius: '12px', background: 'rgba(15, 118, 110, 0.10)', color: '#0F766E', fontWeight: 700 }}>
                      {currency(row.revenue)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right' }}>
                    <span style={{ display: 'inline-block', minWidth: '88px', padding: '8px 10px', borderRadius: '12px', background: `rgba(29, 78, 216, ${Math.max(0.12, row.share_of_category / 100)})`, color: row.share_of_category >= 25 ? '#FFFFFF' : '#1E3A8A', fontWeight: 700 }}>
                      {percent(row.share_of_category)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>{row.rank_within_category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  )

  const renderLocationsTab = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.9fr)', gap: '20px', marginBottom: '24px' }}>
        <SectionCard title="Location Performance Map" subtitle="Each marker is tied to backend location revenue and a stable presentation-ready coordinate model.">
          <div style={{ height: '520px', borderRadius: '18px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <LocationMap locations={data!.location_map.map((location) => ({ location: location.name, revenue: location.revenue, latitude: location.latitude, longitude: location.longitude }))} onSelectLocation={selectLocation} />
          </div>
        </SectionCard>

        <SectionCard title="Focused Location Profile" subtitle="This card diagnoses one selected site so the map and ranking are not just repeated in list form.">
          <div style={{ display: 'grid', gap: '14px' }}>
            {focusLocationSummary ? (
              <>
                <div style={{ padding: '18px', borderRadius: '18px', background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <div style={{ fontSize: '12px', color: '#1D4ED8', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Selected Location</div>
                  <div style={{ marginTop: '8px', fontSize: '22px', fontWeight: 900, color: '#0F172A' }}>{focusLocationSummary.name}</div>
                  <div style={{ marginTop: '10px', fontSize: '15px', lineHeight: 1.7, color: '#334155' }}>
                    Revenue {currency(focusLocationSummary.revenue)} | Share {percent(focusLocationSummary.share)} | Machines {focusLocationSummary.machine_count} | Average ticket {currency(focusLocationSummary.average_ticket)}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  <MetricChip label="Top Category" value={focusLocationSummary.top_category} />
                  <MetricChip label="Share" value={percent(focusLocationSummary.share)} />
                  <MetricChip label="Machines" value={String(focusLocationSummary.machine_count)} />
                </div>
                <div style={{ padding: '18px', borderRadius: '18px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '10px' }}>Strongest Categories At This Site</div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {focusLocationTopCategories.map((cell) => (
                      <div key={`${focusLocationSummary.name}-${cell.category}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.7fr 0.7fr', gap: '10px', fontSize: '14px', color: '#334155' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{cell.category}</div>
                        <div>{currency(cell.revenue)}</div>
                        <div style={{ textAlign: 'right' }}>{percent(cell.share_of_location)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <SectionCard title="Location Revenue Ranking" subtitle="Horizontal ranking keeps the strongest-performing sites visible from a distance.">
          <div style={{ height: '360px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topLocationBars} layout="vertical" margin={{ top: 8, right: 18, left: 60, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="displayName" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={180} />
                <Tooltip formatter={(value: any, _name: any, entry: any) => [currency(Number(value)), `Click to filter ${entry?.payload?.name ?? ''}`]} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]} onClick={(payload: any) => selectLocation(String(payload.name))} style={{ cursor: 'pointer' }}>
                  {topLocationBars.map((item, index) => <Cell key={index} fill={item.name === filters.location ? '#1D4ED8' : CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Location Category Dependency" subtitle="This view shows how dependent each site is on its strongest category. High dependency can signal assortment risk or limited cross-sell breadth.">
          <div style={{ height: '360px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={locationDependencyBars} layout="vertical" margin={{ top: 8, right: 24, left: 76, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="displayName" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={190} />
                <Tooltip
                  formatter={(value: any, name: any, entry: any) => [name === 'strongest_share' ? `${Number(value).toFixed(1)}%` : `${Number(value).toFixed(1)}%`, name === 'strongest_share' ? `Strongest category: ${entry?.payload?.strongest_category ?? ''}` : 'Remaining mix']}
                  contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }}
                />
                <Legend />
                <Bar dataKey="strongest_share" stackId="dependency" fill="#B45309" radius={[0, 0, 0, 0]} onClick={(payload: any) => selectLocation(String(payload.location))} style={{ cursor: 'pointer' }} />
                <Bar dataKey="remaining_share" stackId="dependency" fill="#FDE68A" radius={[0, 8, 8, 0]} onClick={(payload: any) => selectLocation(String(payload.location))} style={{ cursor: 'pointer' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Location Category Mix Matrix" subtitle="This matrix shows how product mix changes by site, which is critical for placement and assortment decisions.">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
            <thead>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '12px', textTransform: 'uppercase', color: '#64748B' }}>Location</th>
                {(data!.category_location_matrix[0]?.categories ?? []).map((cell) => (
                  <th key={cell.category} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px', textTransform: 'uppercase', color: '#64748B' }}>
                    {cell.category}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.category_location_matrix.slice(0, DISPLAY_DEPTH).map((row) => (
                <tr key={row.location} style={{ background: row.location === filters.location ? '#F8FAFC' : 'transparent' }}>
                  <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.location}</td>
                  {row.categories.map((cell) => (
                    <td
                      key={`${row.location}-${cell.category}`}
                      style={{ padding: '10px 12px', cursor: 'pointer' }}
                      onClick={() => {
                        if (filters.location === row.location && filters.category === cell.category && !filters.subcategory && !filters.product) {
                          updateFilters({ location: undefined, category: undefined, subcategory: undefined, product: undefined })
                          return
                        }
                        updateFilters({ location: row.location, category: cell.category, subcategory: undefined, product: undefined })
                      }}
                    >
                      <div
                        style={{
                          borderRadius: '14px',
                          padding: '12px 10px',
                          textAlign: 'center',
                          background: `rgba(29, 78, 216, ${Math.max(0.08, cell.share_of_location / 100)})`,
                          border: '1px solid rgba(191, 219, 254, 0.95)',
                          color: cell.share_of_location >= 20 ? '#FFFFFF' : '#1E3A8A',
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 800 }}>{percent(cell.share_of_location)}</div>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>{compactCurrency(cell.revenue)}</div>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  )

  const renderOperationsTab = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <SectionCard title="Fleet Health Status" subtitle={`This operational distribution is based on the latest 7-day snapshot (${data!.operational_range.start} to ${data!.operational_range.end}).`}>
          <div style={{ height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={62} outerRadius={98}>
                  {statusPie.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(value: any) => [Number(value).toLocaleString(), 'Machines']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Utilization Distribution" subtitle="Utilization bands are based on the current operational snapshot, not the selected analytical period.">
          <div style={{ height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data!.utilization_bands} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip formatter={(value: any) => [Number(value).toLocaleString(), 'Machines']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  {data!.utilization_bands.map((_, index) => <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Machine Risk Ranking" subtitle="Risk combines low utilization, negative trend, and short-term forecast pressure from the current snapshot.">
          <div style={{ height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskBars} layout="vertical" margin={{ top: 8, right: 18, left: 70, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="machine" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={100} />
                <Tooltip formatter={(value: any) => [Number(value).toFixed(1), 'Risk Score']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="risk" radius={[0, 10, 10, 0]} onClick={(payload: any) => selectMachine(String(payload.machine))} style={{ cursor: 'pointer' }}>
                  {riskBars.map((item, index) => <Cell key={index} fill={item.machine === filters.machine_id ? '#1D4ED8' : index < 3 ? '#DC2626' : '#F97316'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.9fr)', gap: '20px', marginBottom: '24px' }}>
        <SectionCard title="Machine Revenue vs Utilization" subtitle="This view separates high-revenue healthy machines from weak or underutilized assets. It supports intervention targeting better than a second ranking table.">
          <div style={{ height: '420px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 20, bottom: 16, left: 16 }}>
                <CartesianGrid stroke="#E2E8F0" />
                <XAxis type="number" dataKey="revenue" name="Revenue" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                <YAxis type="number" dataKey="utilization" name="Utilization" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => `${value}%`} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                <ZAxis type="number" dataKey="risk_score" range={[80, 240]} />
                <Tooltip
                  cursor={{ strokeDasharray: '4 4' }}
                  formatter={(value: any, name: any) => [name === 'Revenue' ? currency(Number(value)) : `${Number(value).toFixed(1)}%`, name]}
                  labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.machine_id ?? ''}
                  contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }}
                />
                <Scatter data={machineScatterData} name="Machines" onClick={(payload: any) => selectMachine(String(payload.machine_id))} style={{ cursor: 'pointer' }}>
                  {machineScatterData.map((point) => (
                    <Cell key={point.machine_id} fill={point.machine_id === filters.machine_id ? '#1D4ED8' : statusColor(point.status)} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Focused Machine Profile" subtitle="This selected-machine card replaces the duplicate performance table and gives the operator a single machine-level decision view.">
          {focusMachineSummary ? (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div style={{ padding: '18px', borderRadius: '18px', background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <div style={{ fontSize: '12px', color: '#1D4ED8', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Selected Machine</div>
                <div style={{ marginTop: '8px', fontSize: '22px', fontWeight: 900, color: '#0F172A' }}>{focusMachineSummary.machine_id}</div>
                <div style={{ marginTop: '6px', fontSize: '14px', color: '#475569' }}>{focusMachineSummary.location}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <MetricChip label="Revenue" value={currency(focusMachineSummary.revenue)} />
                <MetricChip label="Utilization" value={percent(focusMachineSummary.utilization)} />
                <MetricChip label="Transactions" value={focusMachineSummary.transactions.toLocaleString()} />
                <MetricChip label="Trend" value={`${focusMachineSummary.trend_pct > 0 ? '+' : ''}${focusMachineSummary.trend_pct.toFixed(1)}%`} tone={focusMachineSummary.trend_pct >= 0 ? 'success' : 'warning'} />
              </div>
              <div style={{ padding: '16px', borderRadius: '18px', background: statusBackground(focusMachineSummary.status), border: `1px solid ${focusMachineSummary.status === 'healthy' ? '#BBF7D0' : focusMachineSummary.status === 'warning' ? '#FED7AA' : '#FECACA'}` }}>
                <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: statusColor(focusMachineSummary.status) }}>Status</div>
                <div style={{ marginTop: '8px', fontSize: '20px', fontWeight: 900, color: '#0F172A' }}>{focusMachineSummary.status}</div>
                <div style={{ marginTop: '8px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
                  {focusMachineQueue?.recommendation ?? 'This machine is not currently in the priority queue.'}
                </div>
              </div>
            </div>
          ) : null}
        </SectionCard>
      </div>

      <SectionCard title="Service Priority Queue" subtitle={`This route handoff is based on the operational snapshot from ${data!.operational_range.start} to ${data!.operational_range.end}.`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                {[
                  ['machine_id', 'Machine', 'left'],
                  ['location', 'Location', 'left'],
                  ['status', 'Status', 'left'],
                  ['utilization', 'Utilization', 'right'],
                  ['forecast_revenue_24h', 'Next 24h', 'right'],
                  ['risk_score', 'Risk', 'right'],
                ].map(([key, label, align]) => (
                  <th key={key} onClick={() => setRestockSort(nextDirection(restockSort, key as keyof RestockPriorityItem))} style={tableHeader(align as 'left' | 'right')}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRestock.slice(0, DISPLAY_DEPTH + 4).map((row) => (
                <tr key={row.machine_id} style={{ borderBottom: '1px solid #EEF2F7', background: row.machine_id === filters.machine_id ? '#F8FAFC' : 'transparent', cursor: 'pointer' }} onClick={() => selectMachine(row.machine_id)}>
                  <td style={{ padding: '12px 10px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.machine_id}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', color: '#475569' }}>{row.location}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '999px', background: statusBackground(row.status), color: statusColor(row.status), fontWeight: 700 }}>
                      {row.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right', color: '#334155' }}>{percent(row.utilization)}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right', color: '#0F766E' }}>{currency(row.forecast_revenue_24h)}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right', fontWeight: 700, color: '#B91C1C' }}>{row.risk_score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  )

  const renderForecastTab = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '24px' }}>
        <MetricChip label="Highest Profit Place" value={data!.kpis.top_location.name} tone="success" />
        <MetricChip label="Highest Profit Category" value={data!.kpis.top_category.name} tone="neutral" />
        <MetricChip label="Highest Profit Product" value={data!.kpis.top_product.name} tone="neutral" />
        <MetricChip label="Machines Needing Attention Now" value={String(data!.kpis.attention_machines)} tone="warning" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.9fr)', gap: '20px', marginBottom: '24px' }}>
        <SectionCard title="Pre-Forecast Revenue Profile" subtitle={`This chart uses the selected analysis window (${data!.analysis_range.start} to ${data!.analysis_range.end}) before any predictive step.`}>
          <div style={{ height: '360px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data!.revenue_series} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Area type="monotone" dataKey="revenue" stroke="#0EA5E9" strokeWidth={3} fill="url(#forecastFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Management Action Priorities" subtitle={`These recommendations come from the operational snapshot (${data!.operational_range.start} to ${data!.operational_range.end}) and complement the trained models in the assistant panel.`}>
          <div style={{ display: 'grid', gap: '14px' }}>
            {data!.action_items.map((item) => (
              <article key={item.title} style={{ padding: '18px', borderRadius: '18px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'inline-flex', padding: '6px 10px', borderRadius: '999px', background: item.priority === 'Critical' ? '#FEF2F2' : item.priority === 'High' ? '#FFF7ED' : '#EFF6FF', color: item.priority === 'Critical' ? '#B91C1C' : item.priority === 'High' ? '#9A3412' : '#1D4ED8', fontSize: '12px', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {item.priority}
                </div>
                <h3 style={{ margin: '12px 0 8px 0', fontSize: '18px', color: '#0F172A' }}>{item.title}</h3>
                <p style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: 1.6 }}>{item.detail}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <SectionCard title="Locations Requiring Commercial Review" subtitle="Lower-ranked sites are easier to justify in the final presentation when paired with actual revenue and category evidence.">
          <div style={{ display: 'grid', gap: '12px' }}>
            {[...data!.location_rankings].slice(-5).map((row) => (
              <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.8fr 0.8fr', gap: '12px', padding: '14px 16px', borderRadius: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.name}</div>
                <div style={{ fontSize: '14px', color: '#0F766E', textAlign: 'right' }}>{currency(row.revenue)}</div>
                <div style={{ fontSize: '14px', color: '#475569', textAlign: 'right' }}>{row.top_category}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Priority Subcategories" subtitle="This provides a cleaner assortment recommendation than coarse category labels alone.">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  {[
                    ['name', 'Subcategory', 'left'],
                    ['category', 'Category', 'left'],
                    ['revenue', 'Revenue', 'right'],
                    ['share', 'Share', 'right'],
                  ].map(([key, label, align]) => (
                    <th key={key} onClick={() => setSubcategorySort(nextDirection(subcategorySort, key as keyof SubcategoryRanking))} style={tableHeader(align as 'left' | 'right')}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSubcategories.slice(0, 12).map((row) => (
                  <tr key={row.name} style={{ borderBottom: '1px solid #EEF2F7' }}>
                    <td style={{ padding: '12px 10px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.name}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#475569' }}>{row.category}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right', color: '#0F766E' }}>{currency(row.revenue)}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right', color: '#334155' }}>{percent(row.share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </>
  )

  const renderActiveTab = () => {
    if (!data) return null
    if (activeTab === 'products') return renderProductsTab()
    if (activeTab === 'locations') return renderLocationsTab()
    if (activeTab === 'operations') return renderOperationsTab()
    if (activeTab === 'forecast') return renderForecastTab()
    return renderExecutiveTab()
  }

  return (
    <div style={pageShell}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 700,
          background: 'rgba(245, 247, 251, 0.97)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid #DCE5EF',
          boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ maxWidth: '1540px', margin: '0 auto', padding: '18px 24px 16px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748B' }}>
                Business intelligence and analysis dashboard
              </div>
              <h1 style={{ fontSize: '38px', lineHeight: 1.05, fontWeight: 950, margin: '8px 0', color: '#0F172A' }}>
                VendoSight Performance Command Center
              </h1>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => refresh()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '14px', border: '1px solid #CBD5E1', background: '#FFFFFF', padding: '12px 14px', fontWeight: 700, color: '#0F172A', cursor: 'pointer' }}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              <button
                onClick={logout}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', borderRadius: '14px', border: '1px solid #FCA5A5', background: '#FFFFFF', padding: '12px 14px', fontWeight: 700, color: '#B91C1C', cursor: 'pointer' }}
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', marginTop: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
            <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '11px 14px',
                    borderRadius: '14px',
                    border: `1px solid ${activeTab === tab.id ? '#BFDBFE' : '#DCE5EF'}`,
                    background: activeTab === tab.id ? '#EFF6FF' : '#FFFFFF',
                    color: activeTab === tab.id ? '#1D4ED8' : '#334155',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '14px', fontWeight: 700 }}>
                <CalendarRange size={16} />
                Period
              </div>
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => setPeriod(option)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '14px',
                    border: `1px solid ${period === option ? '#0F766E' : '#DCE5EF'}`,
                    background: period === option ? '#ECFDF5' : '#FFFFFF',
                    color: period === option ? '#0F766E' : '#334155',
                    fontWeight: 800,
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1540px', margin: '0 auto', padding: '26px 24px 40px 24px', position: 'relative', zIndex: 1 }}>
        {activeFilters.length ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => clearFilter(filter.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '999px',
                  border: '1px solid #BFDBFE',
                  background: '#EFF6FF',
                  color: '#1D4ED8',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {filter.label}
                <span style={{ fontSize: '15px', lineHeight: 1 }}>×</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAllFilters}
              style={{
                padding: '10px 12px',
                borderRadius: '999px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Clear all filters
            </button>
          </div>
        ) : null}

        {loading ? (
          <div style={{ ...cardShell, textAlign: 'center', padding: '48px', fontSize: '16px', color: '#475569' }}>Loading dashboard...</div>
        ) : error ? (
          <div style={{ ...cardShell, textAlign: 'center', padding: '48px', fontSize: '16px', color: '#B91C1C' }}>{error}</div>
        ) : (
          renderActiveTab()
        )}
      </main>
      <BIAssistant period={period} />
    </div>
  )
}

export default DashboardPage
