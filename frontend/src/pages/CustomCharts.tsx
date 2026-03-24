import React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
export const calcBoxStats = (values: number[]) => {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const q1 = sorted[Math.floor(n * 0.25)]
  const median = n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)]
  const q3 = sorted[Math.floor(n * 0.75)]
  const iqr = q3 - q1
  const whiskerLow = Math.max(sorted[0], q1 - 1.5 * iqr)
  const whiskerHigh = Math.min(sorted[n - 1], q3 + 1.5 * iqr)
  const outliers = sorted.filter(v => v < whiskerLow || v > whiskerHigh)
  const mean = sorted.reduce((a, b) => a + b, 0) / n
  return { q1, median, q3, iqr, whiskerLow, whiskerHigh, outliers, mean, min: sorted[0], max: sorted[n - 1] }
}

// ─────────────────────────────────────────────────────────────────────────────
// BoxPlot — horizontal, single group
// ─────────────────────────────────────────────────────────────────────────────
interface BoxPlotProps {
  groups: { label: string; values: number[]; color: string }[]
  width?: number
  height?: number
  domain?: [number, number]
  xLabel?: string
  title?: string
}

export const BoxPlotChart: React.FC<BoxPlotProps> = ({
  groups,
  width = 600,
  height,
  domain = [0, 100],
  xLabel = 'Activity %',
  title,
}) => {
  const rowH = 64
  const padL = 110, padR = 30, padT = 32, padB = 40
  const plotW = width - padL - padR
  const totalH = height ?? groups.length * rowH + padT + padB + 20

  const toX = (v: number) => padL + ((v - domain[0]) / (domain[1] - domain[0])) * plotW

  const ticks = [0, 20, 40, 60, 80, 100].filter(t => t >= domain[0] && t <= domain[1])

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${totalH}`} style={{ overflow: 'visible' }}>
      {title && (
        <text x={width / 2} y={16} textAnchor="middle"
          style={{ fontSize: '12px', fill: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
          {title}
        </text>
      )}

      {/* Grid lines */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={toX(t)} y1={padT} x2={toX(t)} y2={padT + groups.length * rowH}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={toX(t)} y={padT + groups.length * rowH + 16}
            textAnchor="middle" style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>
            {t}%
          </text>
        </g>
      ))}

      {/* X axis label */}
      <text x={padL + plotW / 2} y={totalH - 4} textAnchor="middle"
        style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>
        {xLabel}
      </text>

      {groups.map((g, gi) => {
        const stats = calcBoxStats(g.values)
        if (!stats) return null
        const cy = padT + gi * rowH + rowH / 2
        const boxTop = cy - 14
        const boxBot = cy + 14

        return (
          <g key={g.label}>
            {/* Row bg stripe */}
            <rect x={0} y={padT + gi * rowH} width={width} height={rowH}
              fill={gi % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent'} />

            {/* Label */}
            <text x={padL - 10} y={cy + 4} textAnchor="end"
              style={{ fontSize: '11px', fill: 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
              {g.label}
            </text>

            {/* Whisker line */}
            <line x1={toX(stats.whiskerLow)} y1={cy} x2={toX(stats.whiskerHigh)} y2={cy}
              stroke={g.color} strokeWidth={1.5} strokeOpacity={0.6} />

            {/* Whisker caps */}
            <line x1={toX(stats.whiskerLow)} y1={cy - 6} x2={toX(stats.whiskerLow)} y2={cy + 6}
              stroke={g.color} strokeWidth={1.5} />
            <line x1={toX(stats.whiskerHigh)} y1={cy - 6} x2={toX(stats.whiskerHigh)} y2={cy + 6}
              stroke={g.color} strokeWidth={1.5} />

            {/* IQR box */}
            <rect x={toX(stats.q1)} y={boxTop} width={toX(stats.q3) - toX(stats.q1)} height={boxBot - boxTop}
              fill={`${g.color}25`} stroke={g.color} strokeWidth={1.5} rx={3} />

            {/* Median line */}
            <line x1={toX(stats.median)} y1={boxTop} x2={toX(stats.median)} y2={boxBot}
              stroke={g.color} strokeWidth={2.5} />

            {/* Mean diamond */}
            <polygon
              points={`${toX(stats.mean)},${cy - 6} ${toX(stats.mean) + 5},${cy} ${toX(stats.mean)},${cy + 6} ${toX(stats.mean) - 5},${cy}`}
              fill={g.color} opacity={0.9} />

            {/* Outlier dots */}
            {stats.outliers.map((o, oi) => (
              <circle key={oi} cx={toX(o)} cy={cy} r={3}
                fill="none" stroke={g.color} strokeWidth={1.5} opacity={0.7} />
            ))}

            {/* Mini stats on right */}
            <text x={toX(stats.whiskerHigh) + 8} y={cy - 5}
              style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif' }}>
              med {stats.median.toFixed(0)}%
            </text>
            <text x={toX(stats.whiskerHigh) + 8} y={cy + 10}
              style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>
              n={g.values.length}
            </text>
          </g>
        )
      })}

      {/* Legend */}
      <g transform={`translate(${padL}, ${totalH - 12})`}>
        <rect x={0} y={-5} width={10} height={10} fill="rgba(255,255,255,0.2)" rx={1} />
        <text x={14} y={4} style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>IQR box</text>
        <line x1={80} y1={0} x2={90} y2={0} stroke="rgba(255,255,255,0.5)" strokeWidth={2.5} />
        <text x={94} y={4} style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>median</text>
        <polygon points="150,0 155,5 150,10 145,5" fill="rgba(255,255,255,0.5)" />
        <text x={158} y={4} style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>mean</text>
        <circle cx={210} cy={4} r={3} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} />
        <text x={216} y={4} style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>outlier</text>
      </g>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ViolinPlot — uses kernel density estimation
// ─────────────────────────────────────────────────────────────────────────────
const kernelDensity = (values: number[], bandwidth: number, points: number[]): number[] => {
  return points.map(x => {
    const density = values.reduce((sum, v) => {
      const u = (x - v) / bandwidth
      return sum + Math.exp(-0.5 * u * u) / (bandwidth * Math.sqrt(2 * Math.PI))
    }, 0)
    return density / values.length
  })
}

interface ViolinPlotProps {
  groups: { label: string; values: number[]; color: string }[]
  width?: number
  height?: number
  domain?: [number, number]
  title?: string
}

export const ViolinPlotChart: React.FC<ViolinPlotProps> = ({
  groups,
  width = 600,
  height = 220,
  domain = [0, 100],
  title,
}) => {
  const padL = 50, padR = 20, padT = title ? 36 : 16, padB = 36
  const plotH = height - padT - padB
  const slotW = Math.floor((width - padL - padR) / groups.length)
  const kdePoints = Array.from({ length: 60 }, (_, i) => domain[0] + (i / 59) * (domain[1] - domain[0]))

  const toY = (v: number) => padT + plotH - ((v - domain[0]) / (domain[1] - domain[0])) * plotH

  const ticks = [0, 25, 50, 75, 100].filter(t => t >= domain[0] && t <= domain[1])

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {title && (
        <text x={width / 2} y={20} textAnchor="middle"
          style={{ fontSize: '12px', fill: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
          {title}
        </text>
      )}

      {/* Y axis ticks */}
      {ticks.map(t => (
        <g key={t}>
          <line x1={padL - 4} y1={toY(t)} x2={width - padR} y2={toY(t)}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={padL - 8} y={toY(t) + 4} textAnchor="end"
            style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>
            {t}%
          </text>
        </g>
      ))}

      {groups.map((g, gi) => {
        if (g.values.length < 3) return null
        const stats = calcBoxStats(g.values)
        if (!stats) return null

        const bw = Math.max(3, stats.iqr * 0.4 + 2)
        const densities = kernelDensity(g.values, bw, kdePoints)
        const maxDensity = Math.max(...densities)
        const halfW = slotW * 0.38

        const cx = padL + gi * slotW + slotW / 2

        // Build violin path
        const rightPoints = kdePoints.map((v, i) => {
          const x = cx + (densities[i] / maxDensity) * halfW
          const y = toY(v)
          return `${x},${y}`
        })
        const leftPoints = [...kdePoints].reverse().map((v, i) => {
          const ri = kdePoints.length - 1 - i
          const x = cx - (densities[ri] / maxDensity) * halfW
          const y = toY(v)
          return `${x},${y}`
        })
        const path = `M ${rightPoints[0]} L ${rightPoints.join(' L ')} L ${leftPoints.join(' L ')} Z`

        return (
          <g key={g.label}>
            {/* Violin fill */}
            <path d={path} fill={`${g.color}30`} stroke={g.color} strokeWidth={1.5} />

            {/* IQR box inside violin */}
            <rect
              x={cx - halfW * 0.25} y={toY(stats.q3)}
              width={halfW * 0.5} height={toY(stats.q1) - toY(stats.q3)}
              fill={`${g.color}50`} stroke={g.color} strokeWidth={1} rx={2}
            />

            {/* Median dot */}
            <circle cx={cx} cy={toY(stats.median)} r={5} fill={g.color} />

            {/* Label */}
            <text x={cx} y={height - 6} textAnchor="middle"
              style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
              {g.label}
            </text>

            {/* Median value */}
            <text x={cx} y={toY(stats.median) - 9} textAnchor="middle"
              style={{ fontSize: '9px', fill: g.color, fontFamily: 'Inter, sans-serif', fontWeight: 700 }}>
              {stats.median.toFixed(0)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ScatterPlot — utilization vs revenue (or any two numeric axes)
// ─────────────────────────────────────────────────────────────────────────────
interface ScatterPoint {
  x: number
  y: number
  label: string
  color?: string
  r?: number
}

interface ScatterPlotProps {
  points: ScatterPoint[]
  width?: number
  height?: number
  xLabel?: string
  yLabel?: string
  title?: string
  xDomain?: [number, number]
  yDomain?: [number, number]
  onPointClick?: (label: string) => void
}

export const ScatterPlotChart: React.FC<ScatterPlotProps> = ({
  points,
  width = 600,
  height = 260,
  xLabel = 'Activity %',
  yLabel = 'Revenue $K',
  title,
  xDomain,
  yDomain,
  onPointClick,
}) => {
  const [hovered, setHovered] = React.useState<string | null>(null)

  const padL = 52, padR = 20, padT = title ? 36 : 20, padB = 48
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const xMin = xDomain?.[0] ?? Math.max(0, Math.min(...xs) - 5)
  const xMax = xDomain?.[1] ?? Math.min(100, Math.max(...xs) + 5)
  const yMin = yDomain?.[0] ?? Math.max(0, Math.min(...ys) - 1)
  const yMax = yDomain?.[1] ?? Math.max(...ys) + 2

  const toX = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * plotW
  const toY = (v: number) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH

  const xTicks = [0, 20, 40, 60, 80, 100].filter(t => t >= xMin && t <= xMax)
  const yRange = yMax - yMin
  const yStep = yRange > 20 ? 10 : yRange > 5 ? 2 : 1
  const yTicks: number[] = []
  for (let t = Math.ceil(yMin / yStep) * yStep; t <= yMax; t += yStep) yTicks.push(t)

  // Simple linear regression
  const n = points.length
  const sumX = xs.reduce((a, b) => a + b, 0)
  const sumY = ys.reduce((a, b) => a + b, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = xs.reduce((s, x) => s + x * x, 0)
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  const trendY1 = slope * xMin + intercept
  const trendY2 = slope * xMax + intercept

  const hovP = hovered ? points.find(p => p.label === hovered) : null

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ cursor: 'default' }}>
      {title && (
        <text x={width / 2} y={20} textAnchor="middle"
          style={{ fontSize: '12px', fill: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
          {title}
        </text>
      )}

      {/* Grid */}
      {xTicks.map(t => (
        <g key={`x${t}`}>
          <line x1={toX(t)} y1={padT} x2={toX(t)} y2={padT + plotH} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={toX(t)} y={padT + plotH + 16} textAnchor="middle"
            style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>{t}%</text>
        </g>
      ))}
      {yTicks.map(t => (
        <g key={`y${t}`}>
          <line x1={padL} y1={toY(t)} x2={padL + plotW} y2={toY(t)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={padL - 6} y={toY(t) + 4} textAnchor="end"
            style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>${t}K</text>
        </g>
      ))}

      {/* Axis labels */}
      <text x={padL + plotW / 2} y={height - 6} textAnchor="middle"
        style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>{xLabel}</text>
      <text x={12} y={padT + plotH / 2} textAnchor="middle" transform={`rotate(-90, 12, ${padT + plotH / 2})`}
        style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>{yLabel}</text>

      {/* Trend line */}
      {n > 2 && (
        <line
          x1={toX(xMin)} y1={toY(Math.max(yMin, Math.min(yMax, trendY1)))}
          x2={toX(xMax)} y2={toY(Math.max(yMin, Math.min(yMax, trendY2)))}
          stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} strokeDasharray="5 4"
        />
      )}

      {/* Points */}
      {points.map(p => {
        const cx = toX(p.x)
        const cy = toY(p.y)
        const isHov = hovered === p.label
        const r = (p.r ?? 5) * (isHov ? 1.6 : 1)
        const col = p.color ?? '#60a5fa'
        return (
          <g key={p.label} style={{ cursor: onPointClick ? 'pointer' : 'default' }}
            onMouseEnter={() => setHovered(p.label)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onPointClick?.(p.label)}
          >
            <circle cx={cx} cy={cy} r={r + 4} fill="transparent" />
            <circle cx={cx} cy={cy} r={r} fill={`${col}${isHov ? 'ff' : '99'}`}
              stroke={col} strokeWidth={isHov ? 2 : 1} />
          </g>
        )
      })}

      {/* Hover tooltip */}
      {hovP && (() => {
        const cx = toX(hovP.x)
        const cy = toY(hovP.y)
        const tipW = 110, tipH = 44
        const tx = Math.min(cx + 10, width - tipW - 4)
        const ty = Math.max(cy - tipH - 6, padT)
        return (
          <g>
            <rect x={tx} y={ty} width={tipW} height={tipH} rx={6}
              fill="rgba(10,15,30,0.95)" stroke="rgba(96,165,250,0.3)" strokeWidth={1} />
            <text x={tx + 8} y={ty + 15}
              style={{ fontSize: '11px', fill: '#fff', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
              {hovP.label.length > 14 ? hovP.label.slice(0, 13) + '…' : hovP.label}
            </text>
            <text x={tx + 8} y={ty + 29}
              style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
              Activity {hovP.x.toFixed(0)}% · Rev ${hovP.y.toFixed(1)}K
            </text>
          </g>
        )
      })()}
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// StackedStatusBar — shows healthy/warning/critical breakdown as a stacked bar
// ─────────────────────────────────────────────────────────────────────────────
interface StackedStatusBarProps {
  healthy: number
  warning: number
  critical: number
  total: number
  height?: number
  showLabels?: boolean
  onSegmentClick?: (status: 'healthy' | 'warning' | 'critical') => void
}

export const StackedStatusBar: React.FC<StackedStatusBarProps> = ({
  healthy, warning, critical, total,
  height = 32, showLabels = true,
  onSegmentClick,
}) => {
  const [hovered, setHovered] = React.useState<string | null>(null)
  if (!total) return null
  const segments = [
    { key: 'healthy' as const, count: healthy, color: '#22c55e', label: 'Healthy' },
    { key: 'warning' as const, count: warning, color: '#eab308', label: 'Warning' },
    { key: 'critical' as const, count: critical, color: '#ef4444', label: 'Needs attention' },
  ]
  return (
    <div>
      <div style={{ display: 'flex', height, borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
        {segments.map(s => {
          const pct = (s.count / total) * 100
          if (!s.count) return null
          return (
            <div
              key={s.key}
              style={{
                flex: pct, background: s.color,
                opacity: hovered && hovered !== s.key ? 0.4 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: onSegmentClick ? 'pointer' : 'default',
                transition: 'opacity 0.2s', minWidth: pct > 6 ? undefined : '4px',
              }}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => onSegmentClick?.(s.key)}
              title={`${s.label}: ${s.count} (${pct.toFixed(1)}%)`}
            >
              {pct > 10 && (
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#000', opacity: 0.7 }}>
                  {s.count}
                </span>
              )}
            </div>
          )
        })}
      </div>
      {showLabels && (
        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
          {segments.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: onSegmentClick ? 'pointer' : 'default' }}
              onClick={() => onSegmentClick?.(s.key)}>
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                {s.label} — {s.count} ({((s.count / total) * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ActivityHistogram — distribution of activity values in bins
// ─────────────────────────────────────────────────────────────────────────────
interface HistogramProps {
  values: number[]
  bins?: number
  width?: number
  height?: number
  title?: string
  domain?: [number, number]
  onBinClick?: (rangeLabel: string) => void
}

export const ActivityHistogram: React.FC<HistogramProps> = ({
  values,
  bins = 10,
  width = 600,
  height = 180,
  domain = [0, 100],
  title,
  onBinClick,
}) => {
  const padL = 36, padR = 16, padT = title ? 32 : 16, padB = 40
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  const step = (domain[1] - domain[0]) / bins
  const counts = Array.from({ length: bins }, (_, i) => {
    const lo = domain[0] + i * step
    const hi = lo + step
    return { lo, hi, count: values.filter(v => v >= lo && (i === bins - 1 ? v <= hi : v < hi)).length }
  })
  const maxCount = Math.max(...counts.map(c => c.count), 1)

  const toX = (v: number) => padL + ((v - domain[0]) / (domain[1] - domain[0])) * plotW
  const toY = (count: number) => padT + plotH - (count / maxCount) * plotH

  const getColor = (lo: number) => {
    if (lo >= 70) return '#22c55e'
    if (lo >= 40) return '#eab308'
    return '#ef4444'
  }

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`}>
      {title && (
        <text x={width / 2} y={18} textAnchor="middle"
          style={{ fontSize: '12px', fill: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>
          {title}
        </text>
      )}

      {/* Y axis */}
      {[0, Math.ceil(maxCount / 2), maxCount].map(t => (
        <g key={t}>
          <line x1={padL} y1={toY(t)} x2={padL + plotW} y2={toY(t)}
            stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
          <text x={padL - 4} y={toY(t) + 4} textAnchor="end"
            style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>{t}</text>
        </g>
      ))}

      {counts.map((b, i) => {
        const x = toX(b.lo) + 1
        const bw = (plotW / bins) - 2
        const y = toY(b.count)
        const col = getColor(b.lo)
        return (
          <g key={i} style={{ cursor: onBinClick ? 'pointer' : 'default' }}
            onClick={() => onBinClick?.(`${b.lo.toFixed(0)}–${b.hi.toFixed(0)}%`)}>
            <rect x={x} y={y} width={bw} height={padT + plotH - y}
              fill={`${col}50`} stroke={col} strokeWidth={1} rx={2} />
            {b.count > 0 && padT + plotH - y > 14 && (
              <text x={x + bw / 2} y={y + 12} textAnchor="middle"
                style={{ fontSize: '9px', fill: col, fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
                {b.count}
              </text>
            )}
            <text x={x + bw / 2} y={padT + plotH + 16} textAnchor="middle"
              style={{ fontSize: '9px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>
              {b.lo.toFixed(0)}
            </text>
          </g>
        )
      })}

      {/* X label */}
      <text x={padL + plotW / 2} y={height - 4} textAnchor="middle"
        style={{ fontSize: '10px', fill: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif' }}>
        Activity %
      </text>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MachineGrid — paginated card grid replacing the 200-bar chart
// ─────────────────────────────────────────────────────────────────────────────
interface MachineGridProps {
  machines: { id: string; utilization: number }[]
  selectedId: string | null
  onSelect: (id: string) => void
  pageSize?: number
}

export const MachineGrid: React.FC<MachineGridProps> = ({
  machines, selectedId, onSelect, pageSize = 24,
}) => {
  const [page, setPage] = React.useState(0)
  const [sortBy, setSortBy] = React.useState<'id' | 'asc' | 'desc'>('desc')

  const sorted = React.useMemo(() => {
    const arr = [...machines]
    if (sortBy === 'id') arr.sort((a, b) => a.id.localeCompare(b.id))
    else if (sortBy === 'asc') arr.sort((a, b) => a.utilization - b.utilization)
    else arr.sort((a, b) => b.utilization - a.utilization)
    return arr
  }, [machines, sortBy])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const pageData = sorted.slice(page * pageSize, (page + 1) * pageSize)

  React.useEffect(() => { setPage(0) }, [machines.length, sortBy])

  const getColor = (u: number) => u >= 70 ? '#22c55e' : u >= 40 ? '#eab308' : '#ef4444'
  const getBg = (u: number) => u >= 70 ? 'rgba(34,197,94,0.1)' : u >= 40 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)'
  const getBorder = (u: number, sel: boolean) => {
    if (sel) return u >= 70 ? '#22c55e' : u >= 40 ? '#eab308' : '#ef4444'
    return u >= 70 ? 'rgba(34,197,94,0.25)' : u >= 40 ? 'rgba(234,179,8,0.25)' : 'rgba(239,68,68,0.25)'
  }

  return (
    <div>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 700, letterSpacing: '0.5px' }}>
          SORT:
        </span>
        {([['desc', 'Highest first'], ['asc', 'Lowest first'], ['id', 'By ID']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSortBy(key)}
            style={{
              padding: '4px 10px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer',
              border: sortBy === key ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
              background: sortBy === key ? 'rgba(96,165,250,0.15)' : 'transparent',
              color: sortBy === key ? '#60a5fa' : 'rgba(255,255,255,0.4)',
            }}>
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
          {sorted.length} machines · page {page + 1}/{totalPages}
        </span>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        {pageData.map(m => {
          const col = getColor(m.utilization)
          const sel = selectedId === m.id
          return (
            <div
              key={m.id}
              onClick={() => onSelect(m.id)}
              style={{
                padding: '10px 10px 8px',
                borderRadius: '10px',
                border: `1.5px solid ${getBorder(m.utilization, sel)}`,
                background: sel ? `${col}20` : getBg(m.utilization),
                cursor: 'pointer',
                transition: 'all 0.15s',
                transform: sel ? 'scale(1.04)' : 'scale(1)',
                boxShadow: sel ? `0 0 0 2px ${col}60` : 'none',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#fff', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {m.id}
              </div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: col, lineHeight: 1, marginBottom: '6px' }}>
                {m.utilization.toFixed(0)}%
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${m.utilization}%`, height: '100%', background: col, borderRadius: '2px', transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: '9px', color: col, marginTop: '5px', fontWeight: '600' }}>
                {m.utilization >= 70 ? '● Healthy' : m.utilization >= 40 ? '◐ Warning' : '○ Critical'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
          <button onClick={() => setPage(0)} disabled={page === 0}
            style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: page === 0 ? 0.4 : 1 }}>
            «
          </button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: page === 0 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: page === 0 ? 0.4 : 1 }}>
            ‹ Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i
            return (
              <button key={p} onClick={() => setPage(p)}
                style={{
                  width: '28px', height: '28px', borderRadius: '5px', fontSize: '11px', cursor: 'pointer',
                  border: p === page ? '1px solid rgba(96,165,250,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  background: p === page ? 'rgba(96,165,250,0.2)' : 'transparent',
                  color: p === page ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                }}>
                {p + 1}
              </button>
            )
          })}
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
            style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: page === totalPages - 1 ? 0.4 : 1 }}>
            Next ›
          </button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1}
            style={{ padding: '4px 10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer', fontSize: '12px', opacity: page === totalPages - 1 ? 0.4 : 1 }}>
            »
          </button>
        </div>
      )}
    </div>
  )
}
