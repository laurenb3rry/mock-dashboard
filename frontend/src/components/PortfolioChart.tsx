import Plot from 'react-plotly.js'

interface HistoryPoint {
  record_date: string
  total_value: number
}

interface AssetSeries {
  name: string
  color: string
  x: string[]
  y: (number | null)[]
}

interface HighlightMode {
  assets: AssetSeries[]  // in positions-table order; assets[0] is topmost band (just below portfolio line)
  selectedAssets: string[]
  maxValue: number
}

interface BenchmarkPoint {
  record_date: string
  spy_value: number
}

interface Props {
  history: HistoryPoint[]
  highlightMode?: HighlightMode | null
  benchmark?: BenchmarkPoint[] | null
}

const PLOT_FONT   = { color: 'rgba(232,234,240,0.45)', size: 11, family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }
const HOVER_LABEL = { bgcolor: '#16161f', bordercolor: 'rgba(0,212,170,0.2)', font: { color: '#e8eaf0', size: 12 } }

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function PortfolioChart({ history, highlightMode, benchmark }: Props) {
  if (history.length === 0) {
    return <p style={{ color: 'var(--muted)', fontSize: '13px', padding: '24px 0' }}>No history data yet.</p>
  }

  const dates  = history.map(h => h.record_date)
  const values = history.map(h => h.total_value)
  
  // the portfolio history drives the visible x-domain
  const xRange: [string, string] = [dates[0], dates[dates.length - 1]]

  let yRange: [number, number]
  let traces: any[]

  if (highlightMode) {
    const { assets, selectedAssets, maxValue } = highlightMode
    const selectedSet = new Set(selectedAssets)
    // const hasSelection = selectedAssets.length > 0

    yRange = [0, maxValue * 1.06]

    // const SELECTED_FILL = 'rgba(0,212,170,0.28)'
    const FAINT_FILL = 'rgba(255,255,255,0)'

    // Use each asset's own color for its area fill
    function getAssetFill(asset: AssetSeries, isSelected: boolean): string {
      return isSelected ? hexToRgba(asset.color, 0.65) : FAINT_FILL
    }

    const n = assets.length

    const valueMaps = assets.map(asset => {
      const map = new Map<string, number>()
      asset.x.forEach((date, i) => {
        if (asset.y[i] != null) map.set(date, asset.y[i] as number)
      })
      return map
    })

    const cumY: number[][] = []
    for (let i = 0; i < n; i++) {
      cumY.push(dates.map((date, t) => {
        let sum = 0
        for (let j = 0; j <= i; j++) sum += valueMaps[j].get(date) ?? 0
        return values[t] - sum
      }))
    }

    traces = []

    traces.push({
      x: dates, y: cumY[n - 1],
      type: 'scatter' as const, mode: 'none' as const,
      fill: 'tozeroy' as const, fillcolor: 'rgba(0,0,0,0)',
      hoverinfo: 'skip' as const, showlegend: false,
    })

    for (let i = n - 1; i >= 1; i--) {
      const asset = assets[i]
      const isSelected = selectedSet.has(asset.name)
      const assetVals = dates.map(d => valueMaps[i].get(d) ?? 0)
      traces.push({
        x: dates, y: cumY[i - 1],
        type: 'scatter' as const, mode: 'none' as const,
        fill: 'tonexty' as const,
        fillcolor: getAssetFill(asset, isSelected),
        customdata: assetVals,
        hovertemplate: isSelected
          ? `${asset.name.toUpperCase()}<br>%{x}<br><b>$%{customdata:,.0f}</b><extra></extra>`
          : undefined,
        hoverinfo: isSelected ? undefined : 'skip' as const,
        showlegend: false,
      })
    }

    const isSelected0 = selectedSet.has(assets[0].name)
    const assetVals0  = dates.map(d => valueMaps[0].get(d) ?? 0)
    traces.push({
      x: dates, y: values,
      type: 'scatter' as const, mode: 'none' as const,
      fill: 'tonexty' as const,
      fillcolor: getAssetFill(assets[0], isSelected0),
      customdata: assetVals0,
      hovertemplate: isSelected0
        ? `${assets[0].name.toUpperCase()}<br>%{x}<br><b>$%{customdata:,.0f}</b><extra></extra>`
        : undefined,
      hoverinfo: isSelected0 ? undefined : 'skip' as const,
      showlegend: false,
    })

    traces.push({
      x: [dates[0], dates[dates.length - 1]], y: [100000, 100000],
      type: 'scatter' as const, mode: 'lines' as const,
      line: { color: 'rgba(255,255,255,0.15)', dash: 'dash', width: 1 },
      hoverinfo: 'skip' as const, showlegend: false,
    })

    traces.push({
      x: dates, y: values,
      type: 'scatter' as const, mode: 'lines' as const,
      name: 'Portfolio',
      line: { color: '#00d4aa', width: 2 },
      hovertemplate: 'Portfolio<br>%{x}<br><b>$%{y:,.0f}</b><extra></extra>',
      showlegend: false,
    })

  } else {
    // Y-axis should be based only on the portfolio values currently being graphed.
    // Benchmark/S&P line should not affect the y-axis range at all.
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const span   = maxVal - minVal
    const pad    = span === 0 ? maxVal * 0.05 || 1 : span * 0.12

    yRange = [minVal - pad, maxVal + pad]

    const visibleBenchmark = benchmark
      ? benchmark.filter(b => b.record_date >= xRange[0] && b.record_date <= xRange[1])
      : []

    traces = [
      {
        x: dates, y: values,
        type: 'scatter' as const, mode: 'lines' as const,
        name: 'Portfolio',
        line: { color: '#00d4aa', width: 2 },
        fill: 'tozeroy' as const,
        fillcolor: 'rgba(0,212,170,0.09)',
        hovertemplate: 'Portfolio<br>%{x}<br><b>$%{y:,.0f}</b><extra></extra>',
      },
      {
        x: [dates[0], dates[dates.length - 1]], y: [100000, 100000],
        type: 'scatter' as const, mode: 'lines' as const,
        line: { color: 'rgba(255,255,255,0.15)', dash: 'dash', width: 1 },
        hoverinfo: 'skip' as const, showlegend: false,
      },
    ]

    if (visibleBenchmark.length > 0) {
      traces.push({
        x: visibleBenchmark.map(b => b.record_date),
        y: visibleBenchmark.map(b => b.spy_value),
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'S&P 500',
        line: { color: 'rgba(255,255,255,0.35)', width: 1.5, dash: 'dot' },
        hovertemplate: 'S&P 500<br>%{x}<br><b>$%{y:,.0f}</b><extra></extra>',
      })
    }
  }

  return (
    <Plot
      data={traces}
      layout={{
        paper_bgcolor: 'transparent',
        plot_bgcolor:  'transparent',
        font:   PLOT_FONT,
        margin: { t: 8, r: 16, b: 44, l: 72 },
        xaxis: {
          gridcolor: 'rgba(255,255,255,0.04)',
          linecolor: 'transparent',
          tickfont: { size: 11 },
          showgrid: true,
          range: xRange,     // lock x-axis to portfolio history only
          autorange: false,  // prevent other traces from changing it
        },
        yaxis: {
          gridcolor: 'rgba(255,255,255,0.04)',
          linecolor: 'transparent',
          tickprefix: '$',
          tickformat: ',.0f',
          tickfont: { size: 11 },
          range: yRange,
        },
        showlegend: false,
        hovermode: 'x unified',
        hoverlabel: HOVER_LABEL,
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '360px' }}
      useResizeHandler
    />
  )
}
