import Plot from 'react-plotly.js'
import { useQuery } from '@tanstack/react-query'
import { getDrawdown } from '../api'

const PLOT_FONT = { color: 'rgba(232,234,240,0.45)', size: 11, family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  margin: 0,
}

export default function DrawdownChart() {
  const { data = [] } = useQuery({ queryKey: ['portfolio-drawdown'], queryFn: getDrawdown })

  if (data.length === 0) return null

  const dates    = (data as any[]).map(d => d.record_date)
  const drawdown = (data as any[]).map(d => d.drawdown ?? 0)
  const maxDrawdown = Math.min(...drawdown)

  const traces: any[] = [
    {
      x: [dates[0], dates[dates.length - 1]],
      y: [0, 0],
      type: 'scatter',
      mode: 'lines',
      line: { color: 'rgba(255,255,255,0.15)', width: 1 },
      hoverinfo: 'skip',
      showlegend: false,
    },
    {
      x: dates,
      y: drawdown,
      type: 'scatter',
      mode: 'lines',
      fill: 'tozeroy',
      fillcolor: 'rgba(255,77,77,0.15)',
      line: { color: '#ff4d4d', width: 1.5 },
      hovertemplate: '%{x}<br><b>%{y:.1f}%</b><extra></extra>',
      showlegend: false,
    },
  ]

  return (
    <div>
      <p style={sectionLabel}>Drawdown</p>
      <Plot
        data={traces}
        layout={{
          paper_bgcolor: 'transparent',
          plot_bgcolor:  'transparent',
          font:   PLOT_FONT,
          margin: { t: 16, r: 16, b: 44, l: 72 },
          xaxis: {
            gridcolor: 'rgba(255,255,255,0.04)',
            linecolor: 'transparent',
            tickfont: { size: 11 },
          },
          yaxis: {
            gridcolor: 'rgba(255,255,255,0.04)',
            linecolor: 'transparent',
            tickfont: { size: 11 },
            ticksuffix: '%',
            tickformat: '.1f',
            autorange: true,
          },
          showlegend: false,
          hovermode: 'x unified',
          hoverlabel: { bgcolor: '#16161f', bordercolor: 'rgba(255,77,77,0.3)', font: { color: '#e8eaf0', size: 12 } },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '200px' }}
        useResizeHandler
      />
      <p style={{ fontSize: '12px', color: '#ff4d4d', margin: '4px 0 0' }}>
        Max Drawdown: {maxDrawdown.toFixed(1)}%
      </p>
    </div>
  )
}
