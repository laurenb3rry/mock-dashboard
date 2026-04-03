import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPortfolioCurrent, getPortfolioHistory, getAssets, getBenchmark } from '../api'
import PortfolioChart from '../components/PortfolioChart'
import TotalReturnSankey from '../components/TotalReturnSankey'
import AllocationChart from '../components/AllocationChart'
import DrawdownChart from '../components/DrawdownChart'
import RollingReturnChart from '../components/RollingReturnChart'
import ConfidenceHeatmap from '../components/ConfidenceHeatmap'
import { ALLOCATION_COLORS } from '../constants'

const CARD: React.CSSProperties = {
  padding: 0,
}

const STAT_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
  margin: '0 0 6px',
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.3)',
  margin: 0,
}

function parsePositions(raw: any): any[] {
  if (!raw) return []
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return [] } }
  return Array.isArray(raw) ? raw : []
}

type TimeRange = '1M' | '3M' | '1Y' | 'All'
const TIME_RANGES: TimeRange[] = ['1M', '3M', '1Y', 'All']

function filterHistory(history: any[], range: TimeRange): any[] {
  if (range === 'All' || history.length === 0) return history
  const days = range === '1M' ? 30 : range === '3M' ? 90 : 365
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return history.filter((h: any) => h.record_date >= cutoffStr)
}

function PillButton({ active, disabled, onClick, children }: {
  active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        height: 26,
        fontSize: '11px',
        fontWeight: active ? 600 : 400,
        borderRadius: '20px',
        border: active ? '1px solid rgba(0,212,170,0.3)' : '1px solid rgba(255,255,255,0.08)',
        cursor: disabled ? 'default' : 'pointer',
        backgroundColor: active ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.04)',
        color: active ? '#00d4aa' : disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)',
        transition: 'all 0.12s',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>('All')
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [positionsMode, setPositionsMode] = useState(false)
  const [selectedPortfolioAssets, setSelectedPortfolioAssets] = useState<string[]>([])
  const [showSpy, setShowSpy] = useState(false)
  const [chartView, setChartView] = useState<'portfolio' | 'sankey'>('portfolio')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        e.preventDefault()
        setChartView(v => v === 'portfolio' ? 'sankey' : 'portfolio')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { data: current, isLoading } = useQuery({ queryKey: ['portfolio-current'], queryFn: getPortfolioCurrent, staleTime: Infinity, refetchOnWindowFocus: false })
  const { data: history = [] } = useQuery({ queryKey: ['portfolio-history'], queryFn: getPortfolioHistory })
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: getAssets })
  const { data: benchmarkData } = useQuery({ queryKey: ['portfolio-benchmark'], queryFn: getBenchmark, enabled: showSpy })

  if (isLoading) return <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</p>

  const totalValue = current?.total_value ?? 0
  const pctReturn  = current?.pct_return  ?? 0
  const dollarGain = totalValue - 100000

  const today = new Date().toISOString().slice(0, 10)
  const historyWithToday = (() => {
    if (!current || history.length === 0) return history
    const last = history[history.length - 1]
    if (last?.record_date === today) return history
    return [...history, { record_date: today, total_value: current.total_value }]
  })()

  const positions: any[] = current?.positions ?? []
  const assetNames: string[] = assets.map((a: any) => a.name)

  const allAssetSeries = assetNames.map((name, idx) => {
    const color = ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]
    const filtered = filterHistory(history, timeRange)
    const x: string[] = filtered.map((h: any) => h.record_date)
    const y: (number | null)[] = filtered.map((h: any) => {
      const pos = parsePositions(h.positions_json).find((p: any) => p.asset_name === name)
      return pos?.current_value ?? null
    })
    const todayPos = positions.find((p: any) => p.asset_name === name)
    if (todayPos && x[x.length - 1] !== today) { x.push(today); y.push(todayPos.current_value) }
    return { name, color, x, y }
  })

  const maxPortfolioValue = historyWithToday.length > 0
    ? Math.max(...historyWithToday.map((h: any) => h.total_value))
    : totalValue

  const highlightMode = positionsMode ? {
    assets: allAssetSeries,
    selectedAssets: selectedPortfolioAssets,
    maxValue: maxPortfolioValue,
  } : null

  function togglePortfolioAsset(name: string) {
    if (!positionsMode) return
    setSelectedPortfolioAssets(prev =>
      prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]
    )
  }

  function isolatePortfolioAsset(name: string) {
    if (!positionsMode) return
    setSelectedPortfolioAssets([name])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 8, maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Module 1: Hero card ────────────────────────────────────── */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 32 }}>

          {/* Left column: stats + filter buttons + chart */}
          <div style={{ flex: 1, minWidth: 0, maxWidth: 'calc(100% - 252px)' }}>

            {/* Stats row — centered over the chart, each block clickable to switch chart view */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 72, marginBottom: 8 }}>

              <div
                onClick={() => setChartView('portfolio')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  paddingBottom: 4,
                  borderBottom: chartView === 'portfolio' ? '2px solid #00d4aa' : '2px solid transparent',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <p style={{ ...STAT_LABEL, color: chartView === 'portfolio' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)' }}>Portfolio Value</p>
                <p style={{ fontSize: 32, fontWeight: 800, margin: 0, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                  ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p style={{ fontSize: 12, margin: '4px 0 0', color: '#00d4aa' }}>
                  {pctReturn >= 0 ? '↑' : '↓'} {Math.abs(pctReturn).toFixed(2)}% all time
                </p>
              </div>

              <div style={{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.08)', margin: '0 24px', flexShrink: 0 }} />

              <div
                onClick={() => setChartView('sankey')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  paddingBottom: 4,
                  borderBottom: chartView === 'sankey' ? '2px solid #00d4aa' : '2px solid transparent',
                  transition: 'border-color 0.2s ease',
                }}
              >
                <p style={{ ...STAT_LABEL, color: chartView === 'sankey' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)' }}>Total Return</p>
                <p style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1, color: pctReturn >= 0 ? '#00d4aa' : '#ff4d4d', fontVariantNumeric: 'tabular-nums' }}>
                  {pctReturn >= 0 ? '+' : ''}{pctReturn.toFixed(2)}%
                </p>
                <p style={{ fontSize: 12, margin: '4px 0 0', color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
                  {dollarGain >= 0 ? '+' : ''}${Math.abs(dollarGain).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            {/* Section label — fades between views */}
            <div style={{ position: 'relative', height: 16, marginBottom: 8 }}>
              <p style={{ ...SECTION_LABEL, position: 'absolute', opacity: chartView === 'portfolio' ? 1 : 0, transition: 'opacity 0.15s' }}>
                Portfolio Over Time
              </p>
              <p style={{ ...SECTION_LABEL, position: 'absolute', opacity: chartView === 'sankey' ? 1 : 0, transition: 'opacity 0.15s' }}>
                Return Attribution
              </p>
            </div>

            {/* Filter buttons — always in DOM to prevent layout shift; hidden in sankey view */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginBottom: 0, visibility: chartView === 'portfolio' ? 'visible' : 'hidden' }}>
              {TIME_RANGES.map(r => (
                <PillButton key={r} active={timeRange === r && !positionsMode} disabled={positionsMode} onClick={() => setTimeRange(r)}>
                  {r}
                </PillButton>
              ))}
              <div style={{ width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.12)', margin: '0 4px' }} />
              <PillButton active={showSpy} disabled={positionsMode} onClick={() => { if (!positionsMode) setShowSpy(s => !s) }}>
                vs S&P 500
              </PillButton>
            </div>

            {/* S&P 500 legend — always in DOM (fixed height) to prevent layout shift */}
            <div style={{ display: 'flex', gap: '32px', height: 16, marginBottom: 8, visibility: chartView === 'portfolio' && showSpy ? 'visible' : 'hidden' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                <span style={{ display: 'inline-block', width: 18, height: 2, backgroundColor: '#00d4aa', borderRadius: 1 }} />
                Portfolio
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                <span style={{ display: 'inline-block', width: 18, borderTop: '2px dotted rgba(255,255,255,0.35)' }} />
                S&amp;P 500
              </span>
            </div>

            {/* Chart area — fixed height container prevents layout shift */}
            <div style={{ height: 360, flex: 1 }}>
              {chartView === 'portfolio' ? (
                <PortfolioChart
                  history={filterHistory(historyWithToday, timeRange)}
                  highlightMode={highlightMode}
                  benchmark={showSpy ? (benchmarkData ?? null) : null}
                />
              ) : (
                <TotalReturnSankey />
              )}
            </div>
          </div>

          {/* Right column: positions */}
          <div style={{ width: 220, flexShrink: 0 }}>
            <p
              onClick={() => setPositionsMode(prev => !prev)}
              style={{
                ...SECTION_LABEL,
                marginBottom: 12,
                cursor: 'pointer',
                color: positionsMode ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)',
                transition: 'color 0.15s',
                userSelect: 'none',
              }}
            >
              Positions
            </p>
            {assets.map((a: any, i: number) => {
              const isHighlighted = selectedPortfolioAssets.includes(a.name)
              const assetColor = ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]
              const isLast = i === assets.length - 1
              return (
                <div
                  key={a.name}
                  onClick={() => togglePortfolioAsset(a.name)}
                  onDoubleClick={() => isolatePortfolioAsset(a.name)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    height: 48,
                    borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                    cursor: positionsMode ? 'pointer' : 'default',
                    backgroundColor: positionsMode && isHighlighted ? 'rgba(255,255,255,0.03)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {positionsMode && isHighlighted && (
                      <div style={{ width: 3, height: 14, borderRadius: 2, backgroundColor: assetColor, flexShrink: 0 }} />
                    )}
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: positionsMode && isHighlighted ? assetColor : '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {a.name}
                      </p>
                      <p style={{ fontSize: 11, margin: 0, color: 'rgba(255,255,255,0.35)' }}>
                        {a.allocation_pct?.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 2px', color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
                      ${a.current_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                    <p style={{ fontSize: 12, margin: 0, fontWeight: 700, color: a.pct_return >= 0 ? '#00d4aa' : '#ff4d4d', fontVariantNumeric: 'tabular-nums' }}>
                      {a.pct_return >= 0 ? '+' : ''}{a.pct_return.toFixed(2)}%
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Module 2: Allocation ───────────────────────────────────── */}
      <div style={{ ...CARD, marginTop: 32 }}>
        <p style={{ ...SECTION_LABEL, marginBottom: 8 }}>Allocation</p>
        <AllocationChart assets={assets} positions={positions} selected={selectedAsset} onSelect={setSelectedAsset} />
      </div>

      {/* ── Module 3: Drawdown + Rolling Return ───────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 48 }}>
        <div style={CARD}>
          <DrawdownChart />
        </div>
        <div style={CARD}>
          <RollingReturnChart />
        </div>
      </div>

      {/* ── Module 4: Confidence Heatmap ──────────────────────────── */}
      <div style={{ ...CARD, marginTop: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <ConfidenceHeatmap />
        </div>
      </div>

    </div>
  )
}
