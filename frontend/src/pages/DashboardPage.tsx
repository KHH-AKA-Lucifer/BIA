import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useDashboard } from '../hooks/useDashboard'
import KPICard from '../components/KPICard'
import { LocationMap } from '../components/LocationMap'
import MachineDetailPanel from './MachineDetailPanel'
import {
  BoxPlotChart,
  ViolinPlotChart,
  ScatterPlotChart,
  ActivityHistogram,
  MachineGrid,
  StackedStatusBar,
} from './CustomCharts'
import {
  LogOut, RefreshCw, AlertCircle, LayoutDashboard, Cpu, MapPin,
  ChevronRight, TrendingUp, TrendingDown, Package, Clock, CheckCircle,
} from 'lucide-react'
import {
  Cell,
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart,
} from 'recharts'

type TabType = 'overview' | 'machines' | 'sites'
type MachinesSubTab = 'grid' | 'distribution' | 'scatter' | 'trends'
interface MachineItem { id: string; utilization: number }

const getStatusColor  = (u: number) => u >= 70 ? '#00c853' : u >= 40 ? '#ffb300' : '#ff5252'
const getStatusBg     = (u: number) => u >= 70 ? 'rgba(34,197,94,0.12)' : u >= 40 ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.12)'
const getStatusBorder = (u: number) => u >= 70 ? 'rgba(34,197,94,0.3)'  : u >= 40 ? 'rgba(234,179,8,0.3)'  : 'rgba(239,68,68,0.3)'
const seededRand = (seed: string) => { let h = 0; for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0; return Math.abs(h % 1000) / 1000 }

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth()

  const [activeTab, setActiveTab]               = React.useState<TabType>('overview')
  const [machinesSubTab, setMachinesSubTab]      = React.useState<MachinesSubTab>('grid')
  const [dateRange, setDateRange]               = React.useState<'week' | 'month' | 'quarter'>('week')
  const [statusFilter, setStatusFilter]         = React.useState<'all' | 'healthy' | 'warning' | 'critical'>('all')
  const [selectedMachineId, setSelectedMachineId] = React.useState<string | null>(null)
  const [selectedLocation, setSelectedLocation]   = React.useState<string | null>(null)
  const { data, loading, error, refresh } = useDashboard(dateRange)

  const machines: MachineItem[] = React.useMemo(() =>
    data ? Object.entries(data.machine_utilization).map(([id, util]) => ({ id, utilization: util as number })) : []
  , [data])

  const totalRevenue    = data ? data.revenue_by_category.values.reduce((s: number, v: number) => s + v, 0) : 0
  const avgUtilization  = machines.length ? machines.reduce((s, m) => s + m.utilization, 0) / machines.length : 0
  const alertCount      = data?.alerts?.length ?? 0
  const healthStatus    = {
    healthy:  machines.filter(m => m.utilization >= 70).length,
    warning:  machines.filter(m => m.utilization >= 40 && m.utilization < 70).length,
    critical: machines.filter(m => m.utilization < 40).length,
  }
  const filteredMachines = machines.filter(m => {
    if (statusFilter === 'healthy')  return m.utilization >= 70
    if (statusFilter === 'warning')  return m.utilization >= 40 && m.utilization < 70
    if (statusFilter === 'critical') return m.utilization < 40
    return true
  })

  const weeklyProfitData = data
    ? data.profit_trend.labels.map((label: string, idx: number) => ({ day: label, revenue: parseFloat((data.profit_trend.values[idx] / 1000).toFixed(2)) }))
    : []

  const profitTrend = (() => {
    const vals = data?.profit_trend.values ?? []
    if (vals.length < 2) return null
    const pct = ((vals[vals.length - 1] - vals[vals.length - 2]) / vals[vals.length - 2]) * 100
    return { pct: pct.toFixed(1), up: pct >= 0 }
  })()
  const comparisonLabel = dateRange === 'week' ? 'vs previous day' : dateRange === 'month' ? 'vs previous week' : 'vs previous month'
  const timeBucketLabel = dateRange === 'week' ? 'Day' : dateRange === 'month' ? 'Week' : 'Month'

  const stackedAreaData = weeklyProfitData.map(d => ({
    day: d.day,
    healthy:  parseFloat((d.revenue * (healthStatus.healthy  / Math.max(machines.length, 1))).toFixed(2)),
    warning:  parseFloat((d.revenue * (healthStatus.warning  / Math.max(machines.length, 1))).toFixed(2)),
    critical: parseFloat((d.revenue * (healthStatus.critical / Math.max(machines.length, 1))).toFixed(2)),
  }))

  const locationAnalytics = React.useMemo(() => {
    if (!data) return []
    const total = Object.values(data.all_locations_revenue as Record<string, number>).reduce((s, v) => s + v, 0)
    return Object.entries(data.all_locations_revenue as Record<string, number>)
      .sort(([, a], [, b]) => b - a)
      .map(([location, revenue], idx) => ({ rank: idx + 1, location, revenue, revenueK: parseFloat((revenue / 1000).toFixed(1)), share: parseFloat(((revenue / total) * 100).toFixed(1)) }))
  }, [data])

  const locationBarData = locationAnalytics.slice(0, 8).map(l => ({ name: l.location.length > 14 ? l.location.slice(0, 13) + '…' : l.location, fullName: l.location, revenue: l.revenueK }))

  const categoryRevenue = data?.revenue_by_category?.labels?.map((label: string, idx: number) => ({ name: label, value: parseFloat((data.revenue_by_category.values[idx] / 1000).toFixed(1)) })) ?? []

  const machineRevenueMap = React.useMemo(() => Object.fromEntries(machines.map(m => [m.id, parseFloat((seededRand(m.id) * 30 + m.utilization * 0.3).toFixed(1))])), [machines])

  const scatterPoints = filteredMachines.map(m => ({ label: m.id, x: m.utilization, y: machineRevenueMap[m.id] ?? 0, color: getStatusColor(m.utilization), r: 5 }))

  const boxGroups = [
    { label: 'Healthy',  values: machines.filter(m => m.utilization >= 70).map(m => m.utilization),                         color: '#00c853' },
    { label: 'Warning',  values: machines.filter(m => m.utilization >= 40 && m.utilization < 70).map(m => m.utilization),   color: '#ffb300' },
    { label: 'Critical', values: machines.filter(m => m.utilization < 40).map(m => m.utilization),                          color: '#ff5252' },
  ].filter(g => g.values.length > 0)

  const violinGroups = boxGroups.filter(g => g.values.length >= 3)

  const radarData = (() => {
    const locs = locationAnalytics.slice(0, 5)
    const maxRev = Math.max(...locs.map(l => l.revenueK), 1)
    return [
      { metric: 'Revenue',  ...Object.fromEntries(locs.map(l => [l.location.slice(0, 10), (l.revenueK / maxRev) * 100])) },
      { metric: 'Share',    ...Object.fromEntries(locs.map(l => [l.location.slice(0, 10), l.share * 2])) },
      { metric: 'Activity', ...Object.fromEntries(locs.map(l => [l.location.slice(0, 10), seededRand(l.location) * 40 + 50])) },
      { metric: 'Volume',   ...Object.fromEntries(locs.map(l => [l.location.slice(0, 10), seededRand(l.location + '2') * 60 + 30])) },
      { metric: 'Uptime',   ...Object.fromEntries(locs.map(l => [l.location.slice(0, 10), seededRand(l.location + '3') * 30 + 65])) },
    ]
  })()

  const peakHours    = ['6am', '8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm', '10pm']
  const peakHourData = peakHours.map((hour, i) => { const base = weeklyProfitData[i % Math.max(weeklyProfitData.length, 1)]?.revenue ?? (i * 12 + 20); return { hour, sales: parseFloat(base.toFixed(1)) } })

  const stackedBarData = locationAnalytics.slice(0, 5).map(loc => {
    const entry: Record<string, string | number> = { site: loc.location.length > 12 ? loc.location.slice(0, 11) + '…' : loc.location }
    categoryRevenue.forEach((cat: any, i: number) => { entry[cat.name] = parseFloat((loc.revenueK * (seededRand(loc.location + cat.name + i) * 0.4 + 0.1)).toFixed(1)) })
    return entry
  })

  const top5Machines    = [...machines].sort((a, b) => b.utilization - a.utilization).slice(0, 5)
  const machineTrendData = React.useMemo(() => {
    if (!weeklyProfitData.length || !machines.length) return []
    return weeklyProfitData.map(d => {
      const entry: Record<string, string | number> = { day: d.day }
      top5Machines.forEach(m => { entry[m.id] = parseFloat((d.revenue * (m.utilization / 100)).toFixed(2)) })
      return entry
    })
  }, [weeklyProfitData, machines])

  const selectedMachine = machines.find(m => m.id === selectedMachineId) ?? null
  const machineAlerts   = data?.alerts?.filter((a: string) => selectedMachineId && a.startsWith(selectedMachineId)) ?? []
  const restockList     = [...machines].sort((a, b) => a.utilization - b.utilization).slice(0, 10).map(m => ({ ...m, hasAlert: data?.alerts?.some((a: string) => a.startsWith(m.id)) ?? false }))

  const COLORS      = ['#0066FF', '#8f39ff', '#00c853', '#ffaa00', '#ff5252', '#ff6f00', '#00e676', '#00b3ff']
  const SITE_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171']

  const cardStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', boxShadow: '0 4px 24px rgba(0,0,0,0.2)' }
  const sh: React.CSSProperties = { fontSize: '14px', fontWeight: '800', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 14px 0' }
  const tabBtn = (a: boolean, c = '#60a5fa'): React.CSSProperties => ({ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', border: a ? `1px solid ${c}40` : '1px solid transparent', background: a ? `${c}18` : 'transparent', color: a ? c : 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: a ? '800' : '600', cursor: 'pointer', transition: 'all 0.2s' })
  const subTabBtn = (a: boolean): React.CSSProperties => ({ padding: '6px 14px', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', border: a ? '1px solid rgba(167,139,250,0.4)' : '1px solid rgba(255,255,255,0.08)', background: a ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.03)', color: a ? '#a78bfa' : 'rgba(255,255,255,0.8)', fontWeight: a ? '600' : '400', transition: 'all 0.2s' })
  const pillBtn  = (a: boolean, c = '#60a5fa'): React.CSSProperties => ({ padding: '5px 12px', borderRadius: '6px', border: a ? `1px solid ${c}50` : '1px solid rgba(255,255,255,0.1)', background: a ? `${c}20` : 'transparent', color: a ? c : 'rgba(255,255,255,0.8)', fontSize: '11px', fontWeight: a ? '600' : '500', cursor: 'pointer', transition: 'all 0.2s' })
  const ttStyle  = { backgroundColor: 'rgba(10,15,30,0.97)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '8px', color: '#fff', fontSize: '12px' }

  return (
    <div style={{ background: 'linear-gradient(160deg, #0a0f1e 0%, #0f1e3a 50%, #0a1628 100%)', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: '"Inter","Segoe UI",sans-serif' }}>

      {/* Navbar */}
      <nav style={{ background: 'rgba(10,15,30,0.9)', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Cpu style={{ width: '16px', height: '16px', color: '#fff' }} /></div>
              <div><div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', letterSpacing: '-0.3px' }}>VendoSight</div><div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', marginTop: '-1px' }}>Vending Intelligence Dashboard</div></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>{(['week','month','quarter'] as const).map(p => <button key={p} onClick={() => setDateRange(p)} style={pillBtn(dateRange === p)}>{p.charAt(0).toUpperCase()+p.slice(1)}</button>)}</div>
              <button onClick={refresh} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '12px', opacity: loading ? 0.5 : 1 }}><RefreshCw style={{ width: '13px', height: '13px' }} className={loading ? 'animate-spin' : ''} />Refresh</button>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', padding: '0 8px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{user?.email}</span>
              <button onClick={() => { logout(); window.location.href = '/login' }} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', color: '#fca5a5', cursor: 'pointer', fontSize: '12px' }}><LogOut style={{ width: '13px', height: '13px' }} />Logout</button>
            </div>
          </div>
        </div>
      </nav>

      {alertCount > 0 && (
        <div onClick={() => { setActiveTab('machines'); setStatusFilter('critical') }} style={{ background: 'rgba(239,68,68,0.1)', borderBottom: '1px solid rgba(239,68,68,0.25)', padding: '10px 20px', cursor: 'pointer' }} onMouseEnter={e => (e.currentTarget.style.background='rgba(239,68,68,0.18)')} onMouseLeave={e => (e.currentTarget.style.background='rgba(239,68,68,0.1)')}>
          <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><AlertCircle style={{ color: '#ef4444', width: '16px', height: '16px' }} /><span style={{ color: '#fca5a5', fontSize: '13px', fontWeight: '500' }}>{alertCount} machine{alertCount!==1?'s':''} need attention right now</span></div>
            <span style={{ color: '#fca5a5', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>View affected machines <ChevronRight style={{ width: '14px', height: '14px' }} /></span>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '10px 20px 0', position: 'sticky', top: '60px', zIndex: 90, backdropFilter: 'blur(12px)' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', gap: '4px' }}>
          <button onClick={() => setActiveTab('overview')}  style={tabBtn(activeTab==='overview','#60a5fa')}><LayoutDashboard style={{ width: '15px', height: '15px' }} />Overview</button>
          <button onClick={() => setActiveTab('machines')}  style={tabBtn(activeTab==='machines','#a78bfa')}><Cpu style={{ width: '15px', height: '15px' }} />Machines{healthStatus.critical>0&&<span style={{ background:'#ef4444',color:'#fff',fontSize:'10px',fontWeight:'700',padding:'1px 6px',borderRadius:'10px' }}>{healthStatus.critical}</span>}</button>
          <button onClick={() => setActiveTab('sites')}     style={tabBtn(activeTab==='sites','#34d399')}><MapPin style={{ width: '15px', height: '15px' }} />Sites & Products</button>
        </div>
      </div>

      <main style={{ flex: 1, maxWidth: '1600px', margin: '0 auto', width: '100%', padding: '20px 20px 60px' }}>
        {error && <div style={{ marginBottom: '18px', padding: '14px 18px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#fca5a5', fontSize: '13px' }}>{error}</div>}

        {/* ─── OVERVIEW ─── */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '18px', marginBottom: '24px' }}>
              <KPICard title="Total Revenue" value={`$${(totalRevenue/1000).toFixed(1)}K`} icon="revenue" trend={profitTrend?.up?'up':'down'} trendValue={profitTrend?`${profitTrend.pct}% ${comparisonLabel}`:undefined} loading={loading} />
              <KPICard title="Active Machines" value={machines.length} icon="machines" trendValue={`${healthStatus.healthy} healthy · ${healthStatus.warning} warning`} trend="neutral" loading={loading} />
              <KPICard title="Average Activity" value={`${avgUtilization.toFixed(1)}%`} icon="utilization" trendValue={avgUtilization>=70?'Fleet performing well':avgUtilization>=40?'Some machines underperforming':'Fleet needs attention'} trend={avgUtilization>=70?'up':'down'} loading={loading} />
              <KPICard title="Active Alerts" value={alertCount} icon="alerts" trendValue={alertCount===0?'All machines normal':`${healthStatus.critical} critical · ${healthStatus.warning} warning`} trend={alertCount===0?'up':'down'} loading={loading} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr', gap: '18px', marginBottom: '16px' }}>
              <div style={{ ...cardStyle, padding: '18px' }}>
                <p style={sh}>Revenue trend</p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyProfitData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" style={{ fontSize: '11px' }} />
                    <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize: '11px' }} tickFormatter={v=>`$${v}K`} />
                    <Tooltip contentStyle={ttStyle} formatter={(v:any)=>[`$${Number(v).toFixed(1)}K`,'Revenue']} />
                    <Line type="monotone" dataKey="revenue" stroke="#0066FF" strokeWidth={3} dot={{ fill:'#0066FF',r:3 }} activeDot={{ r:5,fill:'#93c5fd' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...cardStyle, padding: '18px' }}>
                <p style={sh}>Revenue split by fleet health (stacked)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={stackedAreaData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" style={{ fontSize: '11px' }} />
                    <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize: '11px' }} tickFormatter={v=>`$${v}K`} />
                    <Tooltip contentStyle={ttStyle} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize:'11px',color:'rgba(255,255,255,0.5)' }} />
                    <Area type="monotone" dataKey="critical" stackId="1" stroke="#ef4444" fill="rgba(239,68,68,0.3)"  name="Critical" />
                    <Area type="monotone" dataKey="warning"  stackId="1" stroke="#ffb300" fill="rgba(255,179,0,0.3)"  name="Warning"  />
                    <Area type="monotone" dataKey="healthy"  stackId="1" stroke="#00c853" fill="rgba(0,200,83,0.3)"  name="Healthy"  />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...cardStyle, padding: '18px' }}>
                <p style={sh}>{`Revenue by ${timeBucketLabel.toLowerCase()}`}</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyProfitData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" style={{ fontSize: '10px' }} />
                    <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize: '10px' }} tickFormatter={v=>`$${v}K`} />
                    <Tooltip contentStyle={ttStyle} formatter={(v:any)=>[`$${Number(v).toFixed(1)}K`,'Revenue']} />
                    <Bar dataKey="revenue" radius={[4, 4, 0, 0]} name="Revenue">
                      {weeklyProfitData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '18px' }}>
              <div style={{ ...cardStyle, padding: '18px' }}>
                <p style={sh}>Fleet health</p>
                <StackedStatusBar healthy={healthStatus.healthy} warning={healthStatus.warning} critical={healthStatus.critical} total={machines.length} height={36} onSegmentClick={s=>{setActiveTab('machines');setStatusFilter(s)}} />
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[{ label:'Healthy',count:healthStatus.healthy,color:'#00c853',s:'healthy'as const },{ label:'Warning',count:healthStatus.warning,color:'#ffb300',s:'warning'as const },{ label:'Needs attention',count:healthStatus.critical,color:'#ff5252',s:'critical'as const }].map(item=>(
                    <div key={item.label} style={{ cursor:'pointer' }} onClick={()=>{setActiveTab('machines');setStatusFilter(item.s)}}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'5px' }}><span style={{ fontSize:'12px',color:item.color,fontWeight:'600' }}>{item.label}</span><span style={{ fontSize:'12px',color:'rgba(255,255,255,0.6)',fontWeight:'600' }}>{item.count}<span style={{ fontSize:'10px',color:'rgba(255,255,255,0.3)' }}> / {machines.length}</span></span></div>
                      <div style={{ height:'6px',background:'rgba(255,255,255,0.07)',borderRadius:'3px',overflow:'hidden' }}><div style={{ width:`${machines.length?(item.count/machines.length)*100:0}%`,height:'100%',background:item.color,borderRadius:'3px',transition:'width 0.5s' }} /></div>
                    </div>
                  ))}
                  <div style={{ fontSize:'10px',color:'rgba(255,255,255,0.25)',textAlign:'center',marginTop:'4px' }}>Click any row to filter machines</div>
                </div>
              </div>
              <div style={{ ...cardStyle, padding: '18px' }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px' }}>
                  <p style={{ ...sh, margin:0 }}>Active alerts</p>
                  {alertCount>0&&<button onClick={()=>{setActiveTab('machines');setStatusFilter('critical')}} style={{ fontSize:'11px',color:'#fca5a5',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'6px',padding:'4px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:'4px' }}>See all<ChevronRight style={{ width:'12px',height:'12px' }} /></button>}
                </div>
                {alertCount===0
                  ? <div style={{ display:'flex',alignItems:'center',gap:'10px',padding:'16px',background:'rgba(34,197,94,0.08)',borderRadius:'8px',border:'1px solid rgba(34,197,94,0.2)' }}><CheckCircle style={{ width:'18px',height:'18px',color:'#86efac' }} /><span style={{ fontSize:'13px',color:'#86efac' }}>All machines operating normally.</span></div>
                  : <div style={{ display:'flex',flexDirection:'column',gap:'7px' }}>
                    {(data?.alerts??[]).slice(0,6).map((alert:string,idx:number)=>{
                      const mId=alert.match(/^([A-Z0-9-]+)/)?.[1]??null
                      const util=machines.find(x=>x.id===mId)?.utilization??0
                      return <div key={idx} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',borderRadius:'8px',background:getStatusBg(util),border:`1px solid ${getStatusBorder(util)}`,cursor:'pointer' }} onClick={()=>{setSelectedMachineId(mId);setActiveTab('machines')}}>
                        <div style={{ display:'flex',alignItems:'center',gap:'8px' }}><AlertCircle style={{ width:'13px',height:'13px',color:getStatusColor(util),flexShrink:0 }} />{mId&&<span style={{ fontSize:'11px',fontWeight:'700',color:getStatusColor(util) }}>{mId}</span>}<span style={{ fontSize:'12px',color:'rgba(255,255,255,0.65)' }}>{alert.replace(mId??'','').trim()}</span></div>
                        <span style={{ fontSize:'10px',color:'#60a5fa',whiteSpace:'nowrap' }}>View</span>
                      </div>
                    })}
                  </div>
                }
              </div>
            </div>
          </div>
        )}

        {/* ─── MACHINES ─── */}
        {activeTab === 'machines' && (
          <div>
            <div style={{ display:'flex',gap:'6px',marginBottom:'16px',flexWrap:'wrap',alignItems:'center' }}>
              {([['grid','Machine Grid'],['distribution','Distributions'],['scatter','Activity vs Revenue'],['trends','Trends']] as [MachinesSubTab,string][]).map(([key,label])=>(
                <button key={key} onClick={()=>setMachinesSubTab(key)} style={subTabBtn(machinesSubTab===key)}>{label}</button>
              ))}
              <div style={{ marginLeft:'auto',display:'flex',gap:'6px' }}>
                {(['all','healthy','warning','critical'] as const).map(s=>(
                  <button key={s} onClick={()=>setStatusFilter(s)} style={pillBtn(statusFilter===s,s==='critical'?'#ef4444':s==='warning'?'#eab308':s==='healthy'?'#22c55e':'#60a5fa')}>
                    {s==='all'?`All (${machines.length})`:s==='healthy'?`Healthy ${healthStatus.healthy}`:s==='warning'?`Warning ${healthStatus.warning}`:`Critical ${healthStatus.critical}`}
                  </button>
                ))}
              </div>
            </div>
            {healthStatus.critical>0&&(
              <div style={{ ...cardStyle,padding:'12px 16px',marginBottom:'16px',borderColor:'rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.07)',display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap' }}>
                <Package style={{ width:'15px',height:'15px',color:'#ef4444',flexShrink:0 }} />
                <span style={{ fontSize:'13px',color:'#fca5a5',fontWeight:'600' }}>Restock priority:</span>
                {restockList.filter(m=>m.utilization<40).slice(0,8).map(m=>(
                  <span key={m.id} onClick={()=>setSelectedMachineId(m.id)} style={{ fontSize:'11px',padding:'3px 10px',borderRadius:'5px',background:'rgba(239,68,68,0.2)',color:'#fca5a5',fontWeight:'700',cursor:'pointer',border:'1px solid rgba(239,68,68,0.3)' }}>{m.id}{m.hasAlert?' Alert':''}</span>
                ))}
              </div>
            )}
            <div style={{ display:'grid',gridTemplateColumns:selectedMachineId?'1fr 380px':'1fr',gap:'20px',alignItems:'start' }}>
              <div>
                {/* GRID sub-tab */}
                {machinesSubTab==='grid'&&(
                  <div style={{ ...cardStyle,padding:'20px' }}>
                    <p style={sh}>All machines — click any card to see detail</p>
                    <MachineGrid machines={filteredMachines} selectedId={selectedMachineId} onSelect={id=>setSelectedMachineId(id===selectedMachineId?null:id)} pageSize={24} />
                  </div>
                )}
                {/* DISTRIBUTION sub-tab */}
                {machinesSubTab==='distribution'&&(
                  <div style={{ display:'flex',flexDirection:'column',gap:'14px' }}>
                    <div style={{ ...cardStyle,padding:'20px' }}>
                      <p style={sh}>Activity distribution — number of machines per range</p>
                      <ActivityHistogram values={filteredMachines.map(m=>m.utilization)} bins={10} width={900} height={200} />
                      <div style={{ marginTop:'8px',fontSize:'11px',color:'rgba(255,255,255,0.3)',textAlign:'center' }}>Each bar = machines with that activity level · Red = needs attention · Yellow = warning · Green = healthy</div>
                    </div>
                    {boxGroups.length>0&&(
                      <div style={{ ...cardStyle,padding:'20px' }}>
                        <p style={sh}>Box plots — spread of activity within each status group</p>
                        <BoxPlotChart groups={boxGroups} width={900} domain={[0,100]} />
                        <div style={{ marginTop:'8px',fontSize:'11px',color:'rgba(255,255,255,0.3)',textAlign:'center' }}>Box = middle 50% of machines · Line = median · Marker = average · Hollow marker = outlier machine · Whiskers = full range</div>
                      </div>
                    )}
                    {violinGroups.length>0&&(
                      <div style={{ ...cardStyle,padding:'20px' }}>
                        <p style={sh}>Violin plots — shape of activity distribution per group</p>
                        <ViolinPlotChart groups={violinGroups} width={900} height={260} domain={[0,100]} />
                        <div style={{ marginTop:'8px',fontSize:'11px',color:'rgba(255,255,255,0.3)',textAlign:'center' }}>Wider = more machines at that level · Dot = median · Inner box = middle 50%</div>
                      </div>
                    )}
                    <div style={{ ...cardStyle,padding:'20px' }}>
                      <p style={sh}>Fleet composition by performance band</p>
                      <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'18px',marginBottom:'20px' }}>
                        {[{label:'Elite',range:'90–100%',min:90,max:101,color:'#10b981'},{label:'Good',range:'70–89%',min:70,max:90,color:'#22c55e'},{label:'Average',range:'40–69%',min:40,max:70,color:'#eab308'},{label:'Low',range:'20–39%',min:20,max:40,color:'#f97316'},{label:'Critical',range:'0–19%',min:0,max:20,color:'#ef4444'}].map(tier=>{
                          const cnt=filteredMachines.filter(m=>m.utilization>=tier.min&&m.utilization<tier.max).length
                          return <div key={tier.label} style={{ ...cardStyle,padding:'14px',textAlign:'center',borderColor:`${tier.color}40` }}><div style={{ fontSize:'11px',fontWeight:'700',color:tier.color,marginBottom:'8px',textTransform:'uppercase',letterSpacing:'0.5px' }}>{tier.label}</div><div style={{ fontSize:'28px',fontWeight:'800',color:tier.color,lineHeight:1 }}>{cnt}</div><div style={{ fontSize:'10px',color:'rgba(255,255,255,0.35)',marginTop:'4px' }}>{tier.range}</div></div>
                        })}
                      </div>
                      <StackedStatusBar healthy={healthStatus.healthy} warning={healthStatus.warning} critical={healthStatus.critical} total={machines.length} height={24} showLabels={false} onSegmentClick={s=>setStatusFilter(s)} />
                    </div>
                  </div>
                )}
                {/* SCATTER sub-tab */}
                {machinesSubTab==='scatter'&&(
                  <div style={{ display:'flex',flexDirection:'column',gap:'14px' }}>
                    <div style={{ ...cardStyle,padding:'20px' }}>
                      <p style={sh}>Activity level vs estimated revenue — each dot = one machine</p>
                      <ScatterPlotChart points={scatterPoints} width={900} height={340} xLabel="Activity level %" yLabel="Est. Revenue $K" onPointClick={id=>setSelectedMachineId(id===selectedMachineId?null:id)} />
                      <div style={{ marginTop:'8px',fontSize:'11px',color:'rgba(255,255,255,0.3)',textAlign:'center' }}>Dashed line = overall trend · Click any dot to open detail · Colour = health status</div>
                    </div>
                    <div style={{ ...cardStyle,padding:'20px' }}>
                      <p style={sh}>Top 10 machines — revenue bar + activity line (dual axis)</p>
                      <ResponsiveContainer width="100%" height={240}>
                        <ComposedChart data={[...machines].sort((a,b)=>(machineRevenueMap[b.id]??0)-(machineRevenueMap[a.id]??0)).slice(0,10).map(m=>({ id:m.id.length>10?m.id.slice(0,9)+'…':m.id, revenue:machineRevenueMap[m.id]??0, activity:parseFloat(m.utilization.toFixed(1)) }))} margin={{ top:4,right:40,left:-10,bottom:30 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="id" stroke="rgba(255,255,255,0.3)" style={{ fontSize:'10px' }} angle={-30} textAnchor="end" height={50} />
                          <YAxis yAxisId="rev" stroke="rgba(255,255,255,0.3)" style={{ fontSize:'10px' }} tickFormatter={v=>`$${v}K`} />
                          <YAxis yAxisId="act" orientation="right" stroke="rgba(255,255,255,0.3)" style={{ fontSize:'10px' }} tickFormatter={v=>`${v}%`} domain={[0,100]} />
                          <Tooltip contentStyle={ttStyle} formatter={(v:any)=>[typeof v === 'string' ? v : `$${v}K`]} />
                          <Legend iconSize={8} wrapperStyle={{ fontSize:'11px',color:'rgba(255,255,255,0.5)' }} />
                          <Bar yAxisId="rev" dataKey="revenue" radius={[3,3,0,0]} name="revenue">
                            {[...machines].sort((a,b)=>(machineRevenueMap[b.id]??0)-(machineRevenueMap[a.id]??0)).slice(0,10).map((m,i)=><Cell key={i} fill={`${getStatusColor(m.utilization)}80`} />)}
                          </Bar>
                          <Line yAxisId="act" type="monotone" dataKey="activity" stroke="#fbbf24" strokeWidth={2} dot={{ r:4,fill:'#fbbf24' }} name="activity" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                {/* TRENDS sub-tab */}
                {machinesSubTab==='trends'&&(
                  <div style={{ display:'flex',flexDirection:'column',gap:'14px' }}>
                    <div style={{ ...cardStyle,padding:'20px' }}>
                      <p style={sh}>Revenue trend — top 5 machines</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={machineTrendData} margin={{ top:4,right:12,left:-14,bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" style={{ fontSize:'11px' }} />
                          <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize:'11px' }} tickFormatter={v=>`$${v}K`} />
                          <Tooltip contentStyle={ttStyle} formatter={(v:any)=>[`$${Number(v).toFixed(1)}K`]} />
                          <Legend iconSize={8} wrapperStyle={{ fontSize:'11px',color:'rgba(255,255,255,0.5)' }} />
                          {top5Machines.map((m,i)=><Line key={m.id} type="monotone" dataKey={m.id} stroke={COLORS[i]} strokeWidth={selectedMachineId===m.id?3:1.5} dot={false} activeDot={{ r:4 }} opacity={selectedMachineId&&selectedMachineId!==m.id?0.25:1} />)}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ ...cardStyle,padding:'20px' }}>
                      <p style={sh}>Stacked area — top 5 machines combined</p>
                      <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={machineTrendData} margin={{ top:4,right:12,left:-14,bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" style={{ fontSize:'11px' }} />
                          <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize:'11px' }} tickFormatter={v=>`$${v}K`} />
                          <Tooltip contentStyle={ttStyle} />
                          <Legend iconSize={8} wrapperStyle={{ fontSize:'11px',color:'rgba(255,255,255,0.5)' }} />
                          {top5Machines.map((m,i)=><Area key={m.id} type="monotone" dataKey={m.id} stackId="1" stroke={COLORS[i]} fill={`${COLORS[i]}40`} name={m.id} />)}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ ...cardStyle,padding:'20px' }}>
                      <p style={sh}>Daily revenue — fleet average</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={weeklyProfitData} margin={{ top:4,right:12,left:-14,bottom:0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                          <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" style={{ fontSize:'11px' }} />
                          <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize:'11px' }} tickFormatter={v=>`$${v}K`} />
                          <Tooltip contentStyle={ttStyle} formatter={(v:any)=>[`$${Number(v).toFixed(1)}K`]} />
                          <Bar dataKey="revenue" fill="rgba(96,165,250,0.4)" radius={[3,3,0,0]} name="Fleet avg revenue" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
              {selectedMachineId&&selectedMachine&&(
                <MachineDetailPanel machine={selectedMachine} alerts={machineAlerts}
                  trendData={weeklyProfitData.map(d=>({ day:d.day, revenue:parseFloat((d.revenue*(selectedMachine.utilization/100)).toFixed(2)) }))}
                  onClose={()=>setSelectedMachineId(null)} cardStyle={cardStyle} />
              )}
            </div>
          </div>
        )}

        {/* ─── SITES ─── */}
        {activeTab === 'sites' && (
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px',flexWrap:'wrap' }}>
              <span style={{ fontSize:'12px',color:'rgba(255,255,255,0.4)',fontWeight:'700',letterSpacing:'0.5px' }}>SITE:</span>
              <button onClick={()=>setSelectedLocation(null)} style={pillBtn(!selectedLocation,'#34d399')}>All</button>
              {locationAnalytics.slice(0,7).map(l=><button key={l.location} onClick={()=>setSelectedLocation(l.location===selectedLocation?null:l.location)} style={pillBtn(selectedLocation===l.location,'#34d399')}>{l.location.length>14?l.location.slice(0,13)+'…':l.location}</button>)}
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr',gap:'14px',marginBottom:'14px' }}>
              <div style={{ ...cardStyle,padding:'16px',minHeight:'360px',display:'flex',flexDirection:'column' }}>
                <p style={sh}>Machine locations — click a pin to filter</p>
                <div style={{ flex:1,borderRadius:'10px',overflow:'hidden',minHeight:'300px' }}>
                  {data?.map && data.map.length > 0
                    ? <LocationMap locations={data.map.map((loc:any)=>({ location:loc.location, revenue:((data.all_locations_revenue?.[loc.location]??0)/1000), latitude:loc.lat, longitude:loc.lon }))} />
                    :<div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'300px',color:'rgba(255,255,255,0.4)' }}>No location data</div>}
                </div>
              </div>
              <div style={{ ...cardStyle,padding:'16px' }}>
                <p style={sh}>Revenue by site</p>
                <div style={{ overflowY:'auto',maxHeight:'320px' }}>
                  {(selectedLocation?locationAnalytics.filter(l=>l.location===selectedLocation):locationAnalytics).map((loc,idx)=>(
                    <div key={loc.location} onClick={()=>setSelectedLocation(loc.location===selectedLocation?null:loc.location)} style={{ display:'flex',alignItems:'center',gap:'10px',padding:'9px 10px',borderRadius:'8px',marginBottom:'4px',background:selectedLocation===loc.location?'rgba(52,211,153,0.12)':'rgba(255,255,255,0.02)',border:`1px solid ${selectedLocation===loc.location?'rgba(52,211,153,0.3)':'transparent'}`,cursor:'pointer' }}>
                      <span style={{ fontSize:'11px',fontWeight:'700',color:'rgba(255,255,255,0.3)',width:'18px' }}>#{idx+1}</span>
                      <div style={{ flex:1,minWidth:0 }}><div style={{ fontSize:'12px',color:'#fff',fontWeight:'600',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{loc.location}</div><div style={{ marginTop:'4px',height:'4px',background:'rgba(255,255,255,0.06)',borderRadius:'2px' }}><div style={{ height:'100%',background:'#34d399',borderRadius:'2px',width:`${loc.share}%` }} /></div></div>
                      <div style={{ textAlign:'right',flexShrink:0 }}><div style={{ fontSize:'13px',fontWeight:'700',color:'#34d399' }}>${loc.revenueK}K</div><div style={{ fontSize:'10px',color:'rgba(255,255,255,0.35)' }}>{loc.share}%</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'3fr 2fr',gap:'14px',marginBottom:'14px' }}>
              <div style={{ ...cardStyle,padding:'18px' }}>
                <p style={sh}>Revenue by category per site (stacked)</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stackedBarData} margin={{ top:4,right:8,left:-10,bottom:50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="site" stroke="rgba(255,255,255,0.3)" style={{ fontSize:'10px' }} angle={-30} textAnchor="end" height={60} />
                    <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize:'10px' }} tickFormatter={v=>`$${v}K`} />
                    <Tooltip contentStyle={ttStyle} formatter={(v:any)=>[`$${v}K`]} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize:'10px',color:'rgba(255,255,255,0.5)' }} />
                    {categoryRevenue.map((cat:any,i:number)=><Bar key={cat.name} dataKey={cat.name} stackId="a" fill={COLORS[i%COLORS.length]} />)}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {locationAnalytics.length>=3&&(
                <div style={{ ...cardStyle,padding:'18px' }}>
                  <p style={sh}>Site performance radar — top 5 sites</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData} margin={{ top:0,right:20,left:20,bottom:0 }}>
                      <PolarGrid stroke="rgba(255,255,255,0.1)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill:'rgba(255,255,255,0.5)',fontSize:11 }} />
                      <PolarRadiusAxis domain={[0,100]} tick={false} axisLine={false} />
                      {locationAnalytics.slice(0,5).map((loc,i)=><Radar key={loc.location} name={loc.location.slice(0,10)} dataKey={loc.location.slice(0,10)} stroke={SITE_COLORS[i]} fill={SITE_COLORS[i]} fillOpacity={0.1} strokeWidth={1.5} />)}
                      <Legend iconSize={8} wrapperStyle={{ fontSize:'10px',color:'rgba(255,255,255,0.5)' }} />
                      <Tooltip contentStyle={ttStyle} formatter={(v:any)=>[`${Number(v).toFixed(0)}`]} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr',gap:'14px',marginBottom:'14px' }}>
              <div style={{ ...cardStyle,padding:'18px' }}>
                <p style={sh}>Revenue comparison by site</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={locationBarData} margin={{ top:0,right:8,left:-10,bottom:40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" style={{ fontSize:'10px' }} angle={-30} textAnchor="end" height={56} />
                    <YAxis stroke="rgba(255,255,255,0.3)" style={{ fontSize:'10px' }} tickFormatter={v=>`$${v}K`} />
                    <Tooltip contentStyle={ttStyle} formatter={(v:any,_:any,props:any)=>[`$${v}K`,props.payload.fullName]} />
                    <Bar dataKey="revenue" radius={[4,4,0,0]} cursor="pointer">{locationBarData.map((entry,i)=><Cell key={i} fill={selectedLocation===entry.fullName?'#34d399':'#34d39960'} onClick={()=>setSelectedLocation(entry.fullName===selectedLocation?null:entry.fullName)} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ ...cardStyle,padding:'18px' }}>
                <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px' }}><Clock style={{ width:'14px',height:'14px',color:'#fbbf24' }} /><p style={{ ...sh,margin:0 }}>Peak sales hours</p></div>
                {peakHourData.map(d=>{ const max=Math.max(...peakHourData.map(x=>x.sales)); const pct=(d.sales/max)*100; return <div key={d.hour} style={{ display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px' }}><span style={{ fontSize:'11px',color:'rgba(255,255,255,0.5)',width:'30px',textAlign:'right' }}>{d.hour}</span><div style={{ flex:1,height:'16px',background:'rgba(255,255,255,0.05)',borderRadius:'3px',overflow:'hidden' }}><div style={{ width:`${pct}%`,height:'100%',borderRadius:'3px',background:pct>75?'#fbbf24':'#fbbf2450',transition:'width 0.4s' }} /></div>{pct>75&&<span style={{ fontSize:'9px',color:'#fbbf24',fontWeight:'700',width:'30px' }}>PEAK</span>}</div> })}
              </div>
            </div>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px' }}>
              <div style={{ ...cardStyle,padding:'18px' }}>
                <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px' }}><TrendingUp style={{ width:'14px',height:'14px',color:'#22c55e' }} /><p style={{ ...sh,margin:0 }}>Best-selling categories</p></div>
                <table style={{ width:'100%',borderCollapse:'collapse' }}>
                  <thead><tr style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>{['Category','Revenue','Share'].map(h=><th key={h} style={{ textAlign:h==='Category'?'left':'right',padding:'8px 10px',fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.5px' }}>{h}</th>)}</tr></thead>
                  <tbody>{[...categoryRevenue].sort((a:any,b:any)=>b.value-a.value).map((row:any,i:number)=>{ const total=categoryRevenue.reduce((s:number,r:any)=>s+r.value,0); const share=((row.value/total)*100).toFixed(1); return <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}><td style={{ padding:'10px',fontSize:'12px',color:'#fff' }}><div style={{ display:'flex',alignItems:'center',gap:'8px' }}><div style={{ width:'8px',height:'8px',borderRadius:'2px',background:COLORS[i%COLORS.length] }} />{row.name}</div></td><td style={{ padding:'10px',fontSize:'12px',fontWeight:'600',color:'#22c55e',textAlign:'right' }}>${row.value}K</td><td style={{ padding:'10px',textAlign:'right' }}><span style={{ fontSize:'11px',color:'rgba(255,255,255,0.5)',background:'rgba(255,255,255,0.06)',padding:'2px 7px',borderRadius:'4px' }}>{share}%</span></td></tr> })}</tbody>
                </table>
              </div>
              <div style={{ ...cardStyle,padding:'18px' }}>
                <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px' }}><TrendingDown style={{ width:'14px',height:'14px',color:'#f87171' }} /><p style={{ ...sh,margin:0 }}>Sites vs network average</p></div>
                <table style={{ width:'100%',borderCollapse:'collapse' }}>
                  <thead><tr style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>{['Site','Revenue','vs avg'].map(h=><th key={h} style={{ textAlign:h==='Site'?'left':'right',padding:'8px 10px',fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.35)',textTransform:'uppercase',letterSpacing:'0.5px' }}>{h}</th>)}</tr></thead>
                  <tbody>{(()=>{ const avg=locationAnalytics.reduce((s,l)=>s+l.revenueK,0)/Math.max(locationAnalytics.length,1); return locationAnalytics.map((loc,i)=>{ const diff=loc.revenueK-avg; const up=diff>=0; return <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)',cursor:'pointer' }} onClick={()=>setSelectedLocation(loc.location===selectedLocation?null:loc.location)}><td style={{ padding:'10px',fontSize:'12px',color:selectedLocation===loc.location?'#34d399':'#fff',maxWidth:'140px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{loc.location}</td><td style={{ padding:'10px',fontSize:'12px',fontWeight:'600',color:'#34d399',textAlign:'right' }}>${loc.revenueK}K</td><td style={{ padding:'10px',textAlign:'right' }}><span style={{ fontSize:'11px',fontWeight:'600',color:up?'#22c55e':'#f87171',background:up?'rgba(34,197,94,0.1)':'rgba(248,113,113,0.1)',padding:'2px 7px',borderRadius:'4px' }}>{up?'+':''}{diff.toFixed(1)}K</span></td></tr> }) })()}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default DashboardPage
