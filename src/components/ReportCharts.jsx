import { useMemo, useState } from 'react'
import { formatVnd } from '../utils/format'

function formatCompactAxis(value) {
  if (value === 0) return '0'
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}tr`
  }
  if (value >= 1000) {
    const k = value / 1000
    return `${Number.isInteger(k) ? k : k.toFixed(1)}k`
  }
  return String(Math.round(value))
}

function niceUpperBound(maxVal) {
  if (maxVal <= 0) return 100_000
  const rough = maxVal * 1.15
  const mag = 10 ** Math.floor(Math.log10(rough))
  const norm = rough / mag
  let nice = 10
  if (norm <= 1) nice = 1
  else if (norm <= 2) nice = 2
  else if (norm <= 2.5) nice = 2.5
  else if (norm <= 5) nice = 5
  return Math.ceil(nice * mag)
}

export function AreaLineChart({
  title,
  summaryLabel,
  summaryValue,
  points,
  color = '#16a34a',
  fillColor = '#16a34a',
  gradientId = 'areaGrad',
  emptyText = 'Không có dữ liệu trong kỳ đã chọn.',
}) {
  const [activeIndex, setActiveIndex] = useState(null)

  const maxDataVal = useMemo(() => {
    let max = 0
    for (const pt of points) {
      if (pt.value > max) max = pt.value
    }
    return niceUpperBound(max)
  }, [points])

  const width = 560
  const height = 220
  const padLeft = 56
  const padRight = 16
  const padTop = 18
  const padBottom = 32
  const plotW = width - padLeft - padRight
  const plotH = height - padTop - padBottom

  const getX = (idx) => {
    if (points.length <= 1) return padLeft + plotW / 2
    return padLeft + (idx / (points.length - 1)) * plotW
  }
  const getY = (val) => padTop + plotH - (Math.max(0, val) / maxDataVal) * plotH

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: maxDataVal * ratio,
    y: padTop + plotH * (1 - ratio),
  }))

  const linePath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(pt.value).toFixed(1)}`)
    .join(' ')

  const areaPath =
    points.length > 1
      ? `${linePath} L ${getX(points.length - 1).toFixed(1)} ${(padTop + plotH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : ''

  const labelStep = points.length <= 8 ? 1 : points.length <= 16 ? 2 : points.length <= 26 ? 4 : 6
  const safeIdx = activeIndex != null && activeIndex < points.length ? activeIndex : null
  const activePoint = safeIdx != null ? points[safeIdx] : null

  return (
    <div className="chart-panel">
      <div className="chart-panel-head">
        <h4>{title}</h4>
        {summaryValue != null && (
          <div className="chart-panel-summary">
            <span>{summaryLabel || 'Tổng:'}</span>{' '}
            <strong className="num" style={{ color }}>
              {formatVnd(summaryValue)}
            </strong>
          </div>
        )}
      </div>

      {points.length === 0 ? (
        <div className="chart-empty muted-sm">{emptyText}</div>
      ) : (
        <div className="chart-box" onMouseLeave={() => setActiveIndex(null)}>
          <svg viewBox={`0 0 ${width} ${height}`} className="revenue-chart-svg" role="img" aria-label={title}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fillColor} stopOpacity="0.28" />
                <stop offset="100%" stopColor={fillColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={padLeft}
                  y1={tick.y}
                  x2={width - padRight}
                  y2={tick.y}
                  stroke="#e2e8f0"
                  strokeDasharray={tick.value === 0 ? undefined : '4 4'}
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 8}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                  className="num"
                >
                  {formatCompactAxis(tick.value)}
                </text>
              </g>
            ))}

            {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}

            {safeIdx != null && (
              <line
                x1={getX(safeIdx)}
                y1={padTop}
                x2={getX(safeIdx)}
                y2={padTop + plotH}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
            )}

            {points.length > 1 && (
              <path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {points.map((pt, idx) => {
              const showDot = safeIdx === idx || points.length <= 14 || pt.value > 0
              if (!showDot) return null
              return (
                <circle
                  key={pt.key}
                  cx={getX(idx)}
                  cy={getY(pt.value)}
                  r={safeIdx === idx ? 5 : 3.2}
                  fill="#ffffff"
                  stroke={color}
                  strokeWidth={safeIdx === idx ? 2.6 : 2}
                />
              )
            })}

            {points.map((pt, idx) => {
              const isEdge = idx === 0 || idx === points.length - 1
              if (!isEdge && idx % labelStep !== 0) return null
              return (
                <text
                  key={`lbl-${pt.key}`}
                  x={getX(idx)}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fill={safeIdx === idx ? color : '#64748b'}
                  fontWeight={safeIdx === idx ? '700' : '500'}
                  className="num"
                >
                  {pt.shortLabel}
                </text>
              )
            })}

            {points.map((pt, idx) => {
              const colW = points.length <= 1 ? plotW : plotW / (points.length - 1)
              const xStart = Math.max(padLeft, getX(idx) - colW / 2)
              const xEnd = Math.min(width - padRight, getX(idx) + colW / 2)
              return (
                <rect
                  key={`hit-${pt.key}`}
                  x={xStart}
                  y={padTop}
                  width={Math.max(8, xEnd - xStart)}
                  height={plotH}
                  fill="transparent"
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => setActiveIndex(idx)}
                />
              )
            })}
          </svg>

          <div className="chart-mini-tooltip">
            {activePoint ? (
              <>
                <strong>{activePoint.fullLabel}</strong>
                <span>
                  <strong className="num" style={{ color }}>
                    {formatVnd(activePoint.value)}
                  </strong>
                  {activePoint.subText ? ` • ${activePoint.subText}` : ''}
                </span>
              </>
            ) : (
              <span className="muted-xs">Rê chuột hoặc chạm vào điểm để xem chi tiết</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function HorizontalBarChart({ title, rows, color = '#0d7a55', valueFormatter = formatVnd }) {
  const maxVal = useMemo(() => {
    let m = 0
    for (const r of rows) if (r.value > m) m = r.value
    return m > 0 ? m : 1
  }, [rows])

  return (
    <div className="chart-panel">
      <div className="chart-panel-head">
        <h4>{title}</h4>
      </div>
      {rows.length === 0 ? (
        <p className="muted-sm">Chưa có dữ liệu.</p>
      ) : (
        <div className="hbar-list">
          {rows.map((r) => {
            const pct = Math.max(2, Math.round((r.value / maxVal) * 100))
            return (
              <div key={r.key} className="hbar-row">
                <div className="hbar-labels">
                  <span>
                    <strong>{r.label}</strong>
                    {r.meta ? <span className="muted-xs"> ({r.meta})</span> : null}
                  </span>
                  <strong className="num">{valueFormatter(r.value)}</strong>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
