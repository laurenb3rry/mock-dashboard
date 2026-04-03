import Plot from 'react-plotly.js'
import { useQuery } from '@tanstack/react-query'
import { getReturnAttribution } from '../api'
import { ALLOCATION_COLORS, hexToRgba } from '../constants'

const ASSET_ORDER = ['gold', 'btc', 'qqq', 'asset4', 'asset5', 'asset6', 'asset7']

// Node indices — fixed
// 0  = Total Return (left)
// 1-7 = assets in ASSET_ORDER (middle)
// 8  = Signal Driven (right)
// 9  = Market Movement (right)
// 10 = Signal Drag (right, only if any asset.total_return < 0)
const SIGNAL_DRIVEN_IDX = 8
const MARKET_MOVE_IDX   = 9
const SIGNAL_DRAG_IDX   = 10

const ASSET_COLOR_MAP: Record<string, string> = Object.fromEntries(
  ASSET_ORDER.map((name, i) => [name, ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]])
)

function fmtDollar(v: number): string {
  const formatted = Math.round(Math.abs(v)).toLocaleString()
  return v >= 0 ? `+$${formatted}` : `−$${formatted}`
}

function fmtPct(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

export default function TotalReturnSankey() {
  const { data: raw, isLoading } = useQuery({
    queryKey: ['return-attribution'],
    queryFn: getReturnAttribution,
  })

  if (isLoading) {
    return (
      <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>Loading return attribution...</p>
      </div>
    )
  }

  const payload              = raw as any
  const assets: any[]        = payload?.assets ?? []
  const portfolioTotalReturn: number = payload?.portfolio_total_return ?? 0

  if (assets.length === 0 || portfolioTotalReturn === 0) {
    return (
      <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center' }}>
          No return data yet — run the strategy on a trading day to see attribution.
        </p>
      </div>
    )
  }

  // ── Pre-render math check (Step 3) ─────────────────────────────────────────

  assets.forEach((asset: any) => {
    const diff = Math.abs(asset.signal_driven + asset.passive - asset.total_return)
    if (diff > 0.02) {
      console.error(`Math broken for ${asset.asset_name}:`, asset)
    }
  })

  const positiveAssets = assets.filter((a: any) => a.total_return >= 0)
  const leftSum  = positiveAssets.reduce((sum: number, a: any) => sum + a.total_return, 0)
  const rightSum = positiveAssets.reduce((sum: number, a: any) => sum + a.signal_driven + a.passive, 0)

  console.log('Left sum (positive assets):', leftSum)
  console.log('Right sum (should equal left):', rightSum)
  console.log('Difference (should be ~0):', Math.abs(leftSum - rightSum))

  if (Math.abs(leftSum - rightSum) > 1) {
    console.warn('Sankey math mismatch — check attribution calculation')
    return (
      <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,77,77,0.6)', fontSize: 13, textAlign: 'center' }}>
          Return attribution calculation error — check console for details.
        </p>
      </div>
    )
  }

  // ── Build links (Step 2) ───────────────────────────────────────────────────
  // Plotly sizes nodes automatically from link flows — do not set node values.

  const hasNegativeAssets = assets.some((a: any) => a.total_return < 0)

  const linkSources: number[]      = []
  const linkTargets: number[]      = []
  const linkValues: number[]       = []
  const linkColors: string[]       = []
  const linkCustomData: string[]   = []

  // Track what flows into right-column nodes (for labels only)
  let signalDrivenInflow = 0
  let marketMoveInflow   = 0
  let signalDragInflow   = 0

  assets.forEach((asset: any, i: number) => {
    const assetIndex = i + 1
    const absReturn  = Math.abs(asset.total_return)
    if (absReturn < 0.01) return

    const pctOfTotal = portfolioTotalReturn !== 0
      ? (asset.total_return / Math.abs(portfolioTotalReturn)) * 100
      : 0
    const assetColor = ASSET_COLOR_MAP[asset.asset_name] ?? ALLOCATION_COLORS[0]

    // Link 1: Total Return → Asset
    linkSources.push(0)
    linkTargets.push(assetIndex)
    linkValues.push(absReturn)
    linkColors.push(
      asset.total_return >= 0
        ? hexToRgba(assetColor, 0.2)
        : 'rgba(255,77,77,0.15)'
    )
    linkCustomData.push(
      `${asset.asset_name.toUpperCase()} | ${fmtDollar(asset.total_return)} | ${fmtPct(pctOfTotal)} of total return`
    )

    if (asset.total_return >= 0) {
      // Link 2a: Asset → Signal Driven
      if (asset.signal_driven > 0.01) {
        const sdPct = portfolioTotalReturn !== 0
          ? (asset.signal_driven / Math.abs(portfolioTotalReturn)) * 100 : 0
        linkSources.push(assetIndex); linkTargets.push(SIGNAL_DRIVEN_IDX)
        linkValues.push(asset.signal_driven)
        linkColors.push('rgba(0,212,170,0.15)')
        linkCustomData.push(
          `${asset.asset_name.toUpperCase()} | Signal Driven: ${fmtDollar(asset.signal_driven)} | ${fmtPct(sdPct)} of total return`
        )
        signalDrivenInflow += asset.signal_driven
      }

      // Link 2b: Asset → Market Movement
      if (asset.passive > 0.01) {
        const mmPct = portfolioTotalReturn !== 0
          ? (asset.passive / Math.abs(portfolioTotalReturn)) * 100 : 0
        linkSources.push(assetIndex); linkTargets.push(MARKET_MOVE_IDX)
        linkValues.push(asset.passive)
        linkColors.push('rgba(255,255,255,0.08)')
        linkCustomData.push(
          `${asset.asset_name.toUpperCase()} | Market Movement: ${fmtDollar(asset.passive)} | ${fmtPct(mmPct)} of total return`
        )
        marketMoveInflow += asset.passive
      }
    } else {
      // Negative asset → Signal Drag
      linkSources.push(assetIndex); linkTargets.push(SIGNAL_DRAG_IDX)
      linkValues.push(absReturn)
      linkColors.push('rgba(255,77,77,0.15)')
      linkCustomData.push(
        `${asset.asset_name.toUpperCase()} | Drag: ${fmtDollar(asset.total_return)} | ${fmtPct(pctOfTotal)} of total return`
      )
      signalDragInflow += absReturn
    }
  })

  // ── Nodes ──────────────────────────────────────────────────────────────────
  // Sizes are computed by Plotly from link flows — labels only here.

  const nodeLabels: string[] = [
    `TOTAL RETURN\n${fmtDollar(portfolioTotalReturn)}`,
    ...assets.map((a: any) => `${a.asset_name.toUpperCase()}\n${fmtDollar(a.total_return)}`),
    `SIGNAL DRIVEN\n${fmtDollar(signalDrivenInflow)}`,
    `MARKET MOVEMENT\n${fmtDollar(marketMoveInflow)}`,
    ...(hasNegativeAssets ? [`SIGNAL DRAG\n${fmtDollar(-signalDragInflow)}`] : []),
  ]

  const nodeColors: string[] = [
    'rgba(0,212,170,0.85)',
    ...assets.map((a: any, i: number) =>
      a.total_return >= 0
        ? hexToRgba(ALLOCATION_COLORS[i % ALLOCATION_COLORS.length], 0.85)
        : 'rgba(255,77,77,0.7)'
    ),
    'rgba(0,212,170,0.6)',
    'rgba(255,255,255,0.25)',
    ...(hasNegativeAssets ? ['rgba(255,77,77,0.6)'] : []),
  ]

  const nodeCustomData: string[] = [
    '',
    ...assets.map((a: any) => {
      const pct = portfolioTotalReturn !== 0
        ? (a.total_return / Math.abs(portfolioTotalReturn)) * 100 : 0
      return `${a.asset_name.toUpperCase()}: ${fmtPct(pct)} of total return`
    }),
    '', '',
    ...(hasNegativeAssets ? [''] : []),
  ]

  // ── Plotly trace ───────────────────────────────────────────────────────────

  // Per-node hovertemplate: only middle asset nodes (1..assets.length) show hover
  const nodeHoverTemplates = nodeLabels.map((_, i) =>
    i >= 1 && i <= assets.length ? '%{customdata}<extra></extra>' : '<extra></extra>'
  )

  const trace = {
    type: 'sankey',
    orientation: 'h',
    node: {
      pad: 24,
      thickness: 20,
      line: { color: 'rgba(255,255,255,0.06)', width: 0.5 },
      label: nodeLabels,
      color: nodeColors,
      customdata: nodeCustomData,
      hovertemplate: nodeHoverTemplates,
    },
    link: {
      source: linkSources,
      target: linkTargets,
      value: linkValues,
      color: linkColors,
      hoverinfo: 'skip',
    },
  }

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor:  'transparent',
    font: {
      family: 'Inter, system-ui, sans-serif',
      size: 11,
      color: 'rgba(255,255,255,0.5)',
    },
    margin: { t: 8, r: 16, b: 8, l: 16 },
  }

  return (
    <>
      <style>{`.js-plotly-plot .sankey-link { pointer-events: none !important; }`}</style>
      <Plot
        data={[trace] as any}
        layout={layout as any}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '360px' }}
        useResizeHandler
      />
    </>
  )
}
