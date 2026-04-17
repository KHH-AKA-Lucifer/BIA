import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../hooks/useDashboard'
import BIAssistant from '../components/BIAssistant'
import KPICard from '../components/KPICard'
import { LocationMap } from '../components/LocationMap'
import type {
  DashboardPeriod,
  DashboardTab,
  LocationRanking,
  MachineRanking,
  ProductRanking,
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
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
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
  const [locationSort] = React.useState<SortState<keyof LocationRanking>>({ key: 'revenue', direction: 'desc' })
  const [productSort, setProductSort] = React.useState<SortState<keyof ProductRanking>>({ key: 'revenue', direction: 'desc' })
  const [subcategorySort, setSubcategorySort] = React.useState<SortState<keyof SubcategoryRanking>>({ key: 'revenue', direction: 'desc' })
  const [machineSort, setMachineSort] = React.useState<SortState<keyof MachineRanking>>({ key: 'revenue', direction: 'desc' })
  const [restockSort, setRestockSort] = React.useState<SortState<keyof RestockPriorityItem>>({ key: 'risk_score', direction: 'desc' })

  const { data, loading, error, refresh } = useDashboard(period)

  const sortedLocations = React.useMemo(() => (data ? sortRows(data.location_rankings, locationSort) : []), [data, locationSort])
  const sortedProducts = React.useMemo(() => (data ? sortRows(data.product_rankings, productSort) : []), [data, productSort])
  const sortedSubcategories = React.useMemo(() => (data ? sortRows(data.subcategory_rankings, subcategorySort) : []), [data, subcategorySort])
  const sortedMachines = React.useMemo(() => (data ? sortRows(data.machine_rankings, machineSort) : []), [data, machineSort])
  const sortedRestock = React.useMemo(() => (data ? sortRows(data.restock_priority, restockSort) : []), [data, restockSort])

  const topLocationBars = data?.location_rankings.slice(0, 10).map((item) => ({
    name: item.name.length > 20 ? `${item.name.slice(0, 20)}...` : item.name,
    revenue: Number(item.revenue.toFixed(0)),
    share: item.share,
  })) ?? []

  const topCategoryBars = data?.category_rankings.slice(0, 8).map((item) => ({
    name: item.name,
    revenue: Number(item.revenue.toFixed(0)),
  })) ?? []

  const topSubcategoryBars = data?.subcategory_rankings.slice(0, 10).map((item) => ({
    name: item.name.length > 24 ? `${item.name.slice(0, 24)}...` : item.name,
    revenue: Number(item.revenue.toFixed(0)),
    category: item.category,
  })) ?? []

  const topProductBars = data?.product_rankings.slice(0, 10).map((item) => ({
    name: item.name.length > 26 ? `${item.name.slice(0, 26)}...` : item.name,
    revenue: Number(item.revenue.toFixed(0)),
  })) ?? []

  const paymentPie = data?.payment_mix ?? []
  const locationTreemap = data?.location_rankings.slice(0, 10).map((item) => ({ name: item.name, size: item.revenue })) ?? []
  const statusPie = data ? [
    { name: 'Healthy', value: data.status_summary.healthy, fill: STATUS_COLORS.healthy },
    { name: 'Warning', value: data.status_summary.warning, fill: STATUS_COLORS.warning },
    { name: 'Critical', value: data.status_summary.critical, fill: STATUS_COLORS.critical },
  ] : []
  const riskBars = sortedRestock.slice(0, 8).map((item) => ({
    machine: item.machine_id,
    risk: item.risk_score,
  }))

  const renderExecutiveTab = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '24px' }}>
        <KPICard eyebrow="Revenue" title="Total revenue this period" value={currency(data!.kpis.total_revenue)} supporting={`${data!.kpis.total_transactions.toLocaleString()} transactions across ${data!.kpis.total_machines} machines`} icon="revenue" tone="positive" />
        <KPICard eyebrow="Location" title="Highest profit place" value={data!.kpis.top_location.name} supporting={`${currency(data!.kpis.top_location.revenue)} | ${percent(data!.kpis.top_location.share)} share`} icon="location" tone="neutral" />
        <KPICard eyebrow="Category" title="Highest profit category" value={data!.kpis.top_category.name} supporting={`${currency(data!.kpis.top_category.revenue)} | ${percent(data!.kpis.top_category.share)} share`} icon="category" tone="neutral" />
        <KPICard eyebrow="Subcategory" title="Highest profit subcategory" value={data!.kpis.top_subcategory.name} supporting={`${currency(data!.kpis.top_subcategory.revenue)} | ${percent(data!.kpis.top_subcategory.share)} share`} icon="category" tone="neutral" />
        <KPICard eyebrow="Product" title="Highest profit product" value={data!.kpis.top_product.name} supporting={`${currency(data!.kpis.top_product.revenue)} | ${percent(data!.kpis.top_product.share)} share`} icon="product" tone="positive" />
        <KPICard eyebrow="Attention" title="Machines needing attention now" value={String(data!.kpis.attention_machines)} supporting={`Based on the operational snapshot from ${data!.operational_range.start} to ${data!.operational_range.end}.`} icon="attention" tone="warning" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.75fr) minmax(320px, 0.95fr)', gap: '20px', marginBottom: '24px' }}>
        <SectionCard
          title="How has revenue moved over the selected period?"
          subtitle="The main performance trend uses a consistent rolling window: week = last 7 days, month = last 30 days, quarter = last 90 days, year = last 365 days."
        >
          <div style={{ height: '380px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data!.revenue_series} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.32} />
                    <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip formatter={(value: any, name: any) => [name === 'revenue' ? currency(Number(value)) : Number(value).toLocaleString(), name === 'revenue' ? 'Revenue' : 'Transactions']} contentStyle={{ borderRadius: 16, border: '1px solid #CBD5E1', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)' }} />
                <Area type="monotone" dataKey="revenue" stroke="#1D4ED8" strokeWidth={3} fill="url(#revenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Executive action board"
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
        <SectionCard title="Which weekday is strongest?" subtitle="Weekday demand reveals the recurring business rhythm behind peak and weak periods.">
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data!.weekday_demand} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                  {data!.weekday_demand.map((_, index) => <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="When do sales peak by hour?" subtitle="Hourly demand is backed by the regenerated timestamped dataset and supports peak-hour staffing and replenishment planning.">
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data!.hourly_demand} margin={{ top: 8, right: 18, left: 8, bottom: 8 }}>
                <defs>
                  <linearGradient id="hourFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0F766E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0F766E" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} minTickGap={16} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Area type="monotone" dataKey="revenue" stroke="#0F766E" strokeWidth={3} fill="url(#hourFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="How do customers pay?" subtitle="Payment mix is useful for transaction behavior and machine interface planning.">
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentPie} dataKey="revenue" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={4}>
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
        <SectionCard title="Which categories generate the most revenue?" subtitle="Category ranking makes the top-profit category visible immediately, not buried in a lower chart.">
          <div style={{ height: '340px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCategoryBars} layout="vertical" margin={{ top: 8, right: 18, left: 40, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={160} />
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]}>
                  {topCategoryBars.map((_, index) => <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Which subcategories are winning?" subtitle="This gives the product assortment a real hierarchy: category first, then revenue-driving subcategories.">
          <div style={{ height: '340px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSubcategoryBars} layout="vertical" margin={{ top: 8, right: 18, left: 60, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={200} />
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]}>
                  {topSubcategoryBars.map((_, index) => <Cell key={index} fill={CATEGORY_COLORS[(index + 2) % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)', gap: '20px', marginBottom: '24px' }}>
        <SectionCard title="Which products generate the most revenue?" subtitle="This is the fastest route to the highest-profit product question, with category and subcategory context beside the product list.">
          <div style={{ height: '380px', marginBottom: '18px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductBars} layout="vertical" margin={{ top: 8, right: 18, left: 110, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={190} />
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]}>
                  {topProductBars.map((_, index) => <Cell key={index} fill={index === 0 ? '#1D4ED8' : '#60A5FA'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  {[
                    ['name', 'Product', 'left'],
                    ['category', 'Category', 'left'],
                    ['subcategory', 'Subcategory', 'left'],
                    ['revenue', 'Revenue', 'right'],
                    ['share', 'Share', 'right'],
                    ['transactions', 'Transactions', 'right'],
                  ].map(([key, label, align]) => (
                    <th key={key} onClick={() => setProductSort(nextDirection(productSort, key as keyof ProductRanking))} style={tableHeader(align as 'left' | 'right')}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedProducts.slice(0, 15).map((row) => (
                  <tr key={row.name} style={{ borderBottom: '1px solid #EEF2F7' }}>
                    <td style={{ padding: '12px 10px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.name}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#475569' }}>{row.category}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#475569' }}>{row.subcategory}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#0F766E', textAlign: 'right' }}>{currency(row.revenue)}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>{percent(row.share)}</td>
                    <td style={{ padding: '12px 10px', fontSize: '14px', color: '#334155', textAlign: 'right' }}>{row.transactions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="How concentrated is product demand?" subtitle="This donut separates dominant categories quickly during a presentation and pairs well with the subcategory bar.">
          <div style={{ height: '380px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data!.category_rankings.slice(0, 6)} dataKey="revenue" nameKey="name" innerRadius={68} outerRadius={110} paddingAngle={3}>
                  {data!.category_rankings.slice(0, 6).map((entry, index) => <Cell key={entry.name} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {sortedSubcategories.slice(0, 6).map((row) => (
              <div key={row.name} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '12px', padding: '12px 14px', borderRadius: '16px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.name}</div>
                <div style={{ fontSize: '14px', color: '#475569' }}>{row.category}</div>
                <div style={{ fontSize: '14px', color: '#0F766E', textAlign: 'right' }}>{currency(row.revenue)}</div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  )

  const renderLocationsTab = () => (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.9fr)', gap: '20px', marginBottom: '24px' }}>
        <SectionCard title="Where are the strongest locations?" subtitle="The map is back. Every marker is tied to backend location revenue and a stable real-world coordinate model for presentation use.">
          <div style={{ height: '520px', borderRadius: '18px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
            <LocationMap locations={data!.location_map.map((location) => ({ location: location.name, revenue: location.revenue, latitude: location.latitude, longitude: location.longitude }))} />
          </div>
        </SectionCard>

        <SectionCard title="Location leaderboard" subtitle="Use this when the professor asks where performance is strongest or weakest.">
          <div style={{ display: 'grid', gap: '12px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
            {sortedLocations.slice(0, 12).map((row, index) => (
              <article key={row.name} style={{ padding: '16px', borderRadius: '18px', background: index === 0 ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${index === 0 ? '#BFDBFE' : '#E2E8F0'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Rank {index + 1}</div>
                    <div style={{ marginTop: '6px', fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>{row.name}</div>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#0F766E' }}>{compactCurrency(row.revenue)}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '14px' }}>
                  <MetricChip label="Share" value={percent(row.share)} />
                  <MetricChip label="Machines" value={String(row.machine_count)} />
                  <MetricChip label="Top Category" value={row.top_category} />
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <SectionCard title="Which locations generate the most revenue?" subtitle="Horizontal ranking keeps the highest-profit place visible from a distance.">
          <div style={{ height: '360px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topLocationBars} layout="vertical" margin={{ top: 8, right: 18, left: 60, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickFormatter={(value) => compactCurrency(value)} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={180} />
                <Tooltip formatter={(value: any) => [currency(Number(value)), 'Revenue']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="revenue" radius={[0, 10, 10, 0]}>
                  {topLocationBars.map((_, index) => <Cell key={index} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="How concentrated is location revenue?" subtitle="Treemap adds a different comparison lens without hiding the top performers.">
          <div style={{ height: '360px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <Treemap data={locationTreemap} dataKey="size" stroke="#FFFFFF" fill="#1D4ED8" />
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Which categories dominate each top location?" subtitle="This heatmap-style matrix shows how product mix changes from site to site, which is critical for placement and assortment decisions.">
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
              {data!.category_location_matrix.map((row) => (
                <tr key={row.location}>
                  <td style={{ padding: '12px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.location}</td>
                  {row.categories.map((cell) => (
                    <td key={`${row.location}-${cell.category}`} style={{ padding: '10px 12px' }}>
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
        <SectionCard title="How healthy is the machine fleet now?" subtitle={`This operational distribution is based on the latest 7-day snapshot (${data!.operational_range.start} to ${data!.operational_range.end}).`}>
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

        <SectionCard title="How is utilization distributed now?" subtitle="Utilization bands use the current operational snapshot, not the selected analytical period.">
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

        <SectionCard title="Which machines are highest risk now?" subtitle="Risk combines low utilization, negative trend, and short-term forecast pressure from the current snapshot.">
          <div style={{ height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskBars} layout="vertical" margin={{ top: 8, right: 18, left: 70, bottom: 8 }}>
                <CartesianGrid stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#CBD5E1' }} />
                <YAxis dataKey="machine" type="category" tick={{ fontSize: 12, fill: '#334155' }} tickLine={false} axisLine={false} width={100} />
                <Tooltip formatter={(value: any) => [Number(value).toFixed(1), 'Risk Score']} contentStyle={{ borderRadius: 14, border: '1px solid #CBD5E1' }} />
                <Bar dataKey="risk" radius={[0, 10, 10, 0]}>
                  {riskBars.map((_, index) => <Cell key={index} fill={index < 3 ? '#DC2626' : '#F97316'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Which machines are strongest right now?" subtitle={`This machine ranking uses the current operational snapshot (${data!.operational_range.start} to ${data!.operational_range.end}).`}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                {[
                  ['machine_id', 'Machine', 'left'],
                  ['location', 'Location', 'left'],
                  ['revenue', 'Revenue', 'right'],
                  ['transactions', 'Transactions', 'right'],
                  ['utilization', 'Utilization', 'right'],
                  ['trend_pct', 'Trend', 'right'],
                  ['status', 'Status', 'left'],
                ].map(([key, label, align]) => (
                  <th key={key} onClick={() => setMachineSort(nextDirection(machineSort, key as keyof MachineRanking))} style={tableHeader(align as 'left' | 'right')}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedMachines.slice(0, 15).map((row) => (
                <tr key={row.machine_id} style={{ borderBottom: '1px solid #EEF2F7' }}>
                  <td style={{ padding: '12px 10px', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{row.machine_id}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', color: '#475569' }}>{row.location}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right', color: '#0F766E', fontWeight: 700 }}>{currency(row.revenue)}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right', color: '#334155' }}>{row.transactions.toLocaleString()}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right', color: '#334155' }}>{percent(row.utilization)}</td>
                  <td style={{ padding: '12px 10px', fontSize: '14px', textAlign: 'right', color: row.trend_pct < 0 ? '#B91C1C' : '#15803D', fontWeight: 700 }}>
                    {row.trend_pct > 0 ? '+' : ''}
                    {row.trend_pct.toFixed(1)}%
                  </td>
                  <td style={{ padding: '12px 10px', fontSize: '14px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '999px', background: statusBackground(row.status), color: statusColor(row.status), fontWeight: 700 }}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div style={{ height: '20px' }} />

      <SectionCard title="Which machines need attention now?" subtitle={`This route handoff is based on the operational snapshot from ${data!.operational_range.start} to ${data!.operational_range.end}.`}>
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
              {sortedRestock.slice(0, 12).map((row) => (
                <tr key={row.machine_id} style={{ borderBottom: '1px solid #EEF2F7' }}>
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
        <SectionCard title="What does the recent revenue profile look like before modeling?" subtitle={`This chart uses the selected analysis window (${data!.analysis_range.start} to ${data!.analysis_range.end}) before any predictive step.`}>
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

        <SectionCard title="Which actions deserve management attention?" subtitle={`These recommendations come from the operational snapshot (${data!.operational_range.start} to ${data!.operational_range.end}) and complement the trained models in the assistant panel.`}>
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
        <SectionCard title="Which locations need commercial review?" subtitle="Lower-ranked sites are easier to justify in the final presentation when paired with actual revenue and category evidence.">
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

        <SectionCard title="Which subcategories should stay front and center?" subtitle="This gives a cleaner assortment recommendation than coarse category labels alone.">
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
          zIndex: 30,
          background: 'rgba(245, 247, 251, 0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #DCE5EF',
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
              <div style={{ fontSize: '15px', color: '#475569', lineHeight: 1.6 }}>
                {data
                  ? `Synthetic U.S.-style vending benchmark data from ${data.available_range.start} to ${data.available_range.end}. Analysis window: ${data.analysis_range.start} to ${data.analysis_range.end}. Operations snapshot: ${data.operational_range.start} to ${data.operational_range.end}.`
                  : 'Loading dashboard context...'}
              </div>
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

      <main style={{ maxWidth: '1540px', margin: '0 auto', padding: '26px 24px 40px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '18px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <MetricChip label="Analysis Window" value={data ? `${data.analysis_range.start} to ${data.analysis_range.end}` : 'Loading'} />
            <MetricChip label="Operations Snapshot" value={data ? `${data.operational_range.start} to ${data.operational_range.end}` : 'Loading'} tone="warning" />
          </div>
        </div>

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
