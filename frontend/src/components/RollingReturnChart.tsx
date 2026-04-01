import Plot from 'react-plotly.js'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getStrategyEvaluations } from '../api'

const PLOT_FONT = { color: 'rgba(232,234,240,0.45)', size: 11, family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  margin: 0,
}

function formatPct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

export default function RollingReturnChart() {
  const { data = [] } = useQuery({ queryKey: ['strategy-evaluations'], queryFn: getStrategyEvaluations })
  const [showInfo, setShowInfo] = useState(false)

  if ((data as any[]).length === 0) return null

  const dates   = (data as any[]).map((d: any) => d.eval_date)
  const returns = (data as any[]).map((d: any) => d.rolling_30d_return)

  const colors = returns.map((v: number | null) =>
    v == null ? 'rgba(255,255,255,0.08)' : v >= 0 ? '#00d4aa' : '#ff4d4d'
  )

  const validReturns = returns.filter((v: any) => v != null) as number[]
  const best  = validReturns.length > 0 ? Math.max(...validReturns) : 0
  const worst = validReturns.length > 0 ? Math.min(...validReturns) : 0

  const traces: any[] = [
    {
      x: dates,
      y: returns,
      type: 'bar',
      marker: { color: colors, opacity: 0.8 },
      hovertemplate: '%{x}<br><b>30-day return: ' + '%{y:+.1f}%</b><extra></extra>',
      showlegend: false,
    },
  ]

  const layout: any = {
    paper_bgcolor: 'transparent',
    plot_bgcolor:  'transparent',
    font:   PLOT_FONT,
    margin: { t: 24, r: 16, b: 44, l: 72 },
    xaxis: {
      gridcolor: 'rgba(255,255,255,0.04)',
      linecolor: 'transparent',
      tickfont:  { size: 11 },
    },
    yaxis: {
      gridcolor: 'rgba(255,255,255,0.04)',
      linecolor: 'transparent',
      tickfont:  { size: 11 },
      ticksuffix: '%',
      tickformat: '+.1f',
    },
    showlegend: false,
    hovermode: 'x unified',
    hoverlabel: { bgcolor: '#1a1a2e', bordercolor: 'rgba(0,212,170,0.3)', font: { color: '#fff', size: 12 } },
    shapes: [
      { type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: 'rgba(255,255,255,0.2)', width: 1 } },
    ],
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <p style={sectionLabel}>Rolling 30-Day Return</p>
        <div
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
          onMouseEnter={() => setShowInfo(true)}
          onMouseLeave={() => setShowInfo(false)}
        >
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', cursor: 'default', lineHeight: 1 }}>ⓘ</span>
          {showInfo && (
            <div style={{
              position: 'absolute',
              bottom: '120%',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#1a1a2e',
              border: '1px solid rgba(0,212,170,0.3)',
              color: '#fff',
              fontSize: '11px',
              padding: '8px 10px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              zIndex: 10,
              pointerEvents: 'none',
            }}>
              Shows portfolio return over the 30 days preceding each trading day. Positive bars mean the strategy gained over that window, negative means it lost.
            </div>
          )}
        </div>
      </div>
      <Plot
        data={traces}
        layout={layout}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '220px' }}
        useResizeHandler
      />
      <div style={{ display: 'flex', gap: '32px', marginTop: '8px' }}>
        <p style={{ fontSize: '12px', margin: 0, color: '#00d4aa' }}>
          Best 30-day period: {formatPct(best)}
        </p>
        <p style={{ fontSize: '12px', margin: 0, color: '#ff4d4d' }}>
          Worst 30-day period: {formatPct(worst)}
        </p>
      </div>
    </div>
  )
}
