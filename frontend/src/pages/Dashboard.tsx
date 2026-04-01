import Plot from 'react-plotly.js'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getPortfolioCurrent, getPortfolioHistory, getAssets, getBenchmark } from '../api'
import PortfolioChart from '../components/PortfolioChart'
import AllocationChart from '../components/AllocationChart'
import DrawdownChart from '../components/DrawdownChart'
import SignalAccuracyChart from '../components/SignalAccuracyChart'
import SignalAccuracyScorecard from '../components/SignalAccuracyScorecard'
import { ALLOCATION_COLORS, hexToRgba } from '../constants'

const card: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  padding: '16px',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  margin: 0,
}

const PLOT_FONT = { color: 'rgba(232,234,240,0.45)', size: 11, family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' }
const PLOT_BASE = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: PLOT_FONT, showlegend: false }



function parsePositions(raw: any): any[] {
  if (!raw) return []
  if (typeof raw === 'string') { try { return JSON.parse(raw) } catch { return [] } }
  return Array.isArray(raw) ? raw : []
}

function StatItem({ label, value, valueColor, trend }: {
  label: string
  value: string
  valueColor?: string
  trend?: { value: number; suffix?: string }
}) {
  const up = (trend?.value ?? 0) >= 0
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <p style={sectionLabel}>{label}</p>
      <p style={{ fontSize: '36px', fontWeight: 800, margin: 0, lineHeight: 1, color: valueColor ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</p>
      {trend ? (
        <p style={{ fontSize: '13px', margin: 0, color: up ? 'var(--positive)' : 'var(--negative)' }}>
          {up ? '↑' : '↓'} {Math.abs(trend.value).toFixed(2)}%{trend.suffix ? ` ${trend.suffix}` : ''}
        </p>
      ) : (
        <p style={{ fontSize: '13px', margin: 0, color: 'transparent' }}>·</p>
      )}
    </div>
  )
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

function RangeToggle({ range, onChange }: { range: TimeRange; onChange: (r: TimeRange) => void }) {
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {TIME_RANGES.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          style={{
            padding: '4px 9px',
            fontSize: '11px',
            fontWeight: range === r ? 700 : 400,
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: range === r ? 'var(--accent-dim)' : 'transparent',
            color: range === r ? 'var(--accent)' : 'var(--dim)',
            transition: 'all 0.12s',
          }}
        >
          {r}
        </button>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [timeRange,        setTimeRange]        = useState<TimeRange>('All')
  const [posRange,           setPosRange]           = useState<TimeRange>('All')
  const [selectedAsset,      setSelectedAsset]      = useState<string | null>(null)
  const [portfolioHighlight, setPortfolioHighlight] = useState<string | null>(null)
  const [showSpy,            setShowSpy]            = useState(false)
  const { data: current, isLoading } = useQuery({ queryKey: ['portfolio-current'], queryFn: getPortfolioCurrent })
  const { data: history = [] }       = useQuery({ queryKey: ['portfolio-history'],  queryFn: getPortfolioHistory })
  const { data: assets = [] }        = useQuery({ queryKey: ['assets'],             queryFn: getAssets })
  const { data: benchmarkData }      = useQuery({ queryKey: ['portfolio-benchmark'], queryFn: getBenchmark, enabled: showSpy })

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

  const lastTrade = assets
    .map((a: any) => a.last_trade_date)
    .filter(Boolean)
    .sort()
    .pop() ?? '—'

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
    if (todayPos && x[x.length - 1] !== today) {
      x.push(today)
      y.push(todayPos.current_value)
    }
    return { name, color, x, y }
  })

  const maxPortfolioValue = historyWithToday.length > 0
    ? Math.max(...historyWithToday.map((h: any) => h.total_value))
    : totalValue

  const highlightMode = portfolioHighlight ? {
    assets: allAssetSeries,
    selected: portfolioHighlight,
    maxValue: maxPortfolioValue,
  } : null

  const filteredPosHistory = filterHistory(history, posRange)
  const assetLines = (() => {
    if (selectedAsset) {
      const idx  = assetNames.indexOf(selectedAsset)
      const base = ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]
      return [{
        x: filteredPosHistory.map((h: any) => h.record_date),
        y: filteredPosHistory.map((h: any) => {
          const pos = parsePositions(h.positions_json).find((p: any) => p.asset_name === selectedAsset)
          return pos?.current_value ?? null
        }),
        type: 'scatter' as const,
        mode: 'lines'  as const,
        name: selectedAsset.toUpperCase(),
        line: { color: base, width: 2.5 },
        hovertemplate: `${selectedAsset.toUpperCase()}<br>%{x}<br><b>$%{y:,.0f}</b><extra></extra>`,
      }]
    }
    return assetNames.map((name, idx) => {
      const base = ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length]
      return {
        x: filteredPosHistory.map((h: any) => h.record_date),
        y: filteredPosHistory.map((h: any) => {
          const pos = parsePositions(h.positions_json).find((p: any) => p.asset_name === name)
          return pos?.current_value ?? null
        }),
        type: 'scatter' as const,
        mode: 'lines'  as const,
        name: name.toUpperCase(),
        line: { color: hexToRgba(base, 0.25), width: 1 },
        hovertemplate: `${name.toUpperCase()}<br>%{x}<br><b>$%{y:,.0f}</b><extra></extra>`,
      }
    })
  })()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingTop: '24px' }}>

      {/* Stat row */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <StatItem
          label="Portfolio Value"
          value={`$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          trend={{ value: pctReturn, suffix: 'all time' }}
        />
        <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.07)', flexShrink: 0, margin: '0 32px' }} />
        <StatItem
          label="Total Return"
          value={`${pctReturn >= 0 ? '+' : ''}${pctReturn.toFixed(2)}%`}
          valueColor={pctReturn >= 0 ? 'var(--positive)' : 'var(--negative)'}
          trend={{ value: dollarGain / 1000, suffix: `($${Math.abs(dollarGain).toLocaleString(undefined, { maximumFractionDigits: 0 })})` }}
        />
        <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.07)', flexShrink: 0, margin: '0 32px' }} />
        <StatItem label="Last Trade" value={lastTrade} />
      </div>

      {/* Portfolio chart + positions — no card borders */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '40px', alignItems: 'start' }}>
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}
          >
            <p style={sectionLabel}>Portfolio Over Time</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RangeToggle range={timeRange} onChange={setTimeRange} />
              <button
                onClick={() => setShowSpy(s => !s)}
                style={{
                  padding: '4px 12px',
                  fontSize: '12px',
                  borderRadius: '20px',
                  border: showSpy ? '1px solid rgba(0,212,170,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  backgroundColor: showSpy ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.06)',
                  color: showSpy ? '#00d4aa' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.15s',
                }}
              >
                vs S&P 500
              </button>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: '20px',
              marginBottom: '12px',
              minHeight: '16px', // reserves space for legend when toggling
              visibility: showSpy ? 'visible' : 'hidden',
            }}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '18px',
                  height: '2px',
                  backgroundColor: '#00d4aa',
                  borderRadius: '1px',
                }}
              />
              Portfolio
            </span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '18px',
                  borderTop: '2px dotted rgba(255,255,255,0.35)',
                }}
              />
              S&amp;P 500
            </span>
          </div>
          <PortfolioChart
            history={filterHistory(historyWithToday, timeRange)}
            highlightMode={highlightMode}
            benchmark={showSpy ? (benchmarkData ?? null) : null}
          />
        </div>
        <div>
          <p style={{ ...sectionLabel, marginBottom: '16px' }}>Positions</p>
          {assets.map((a: any, i: number) => {
            const isLast      = i === assets.length - 1
            const isHighlighted = portfolioHighlight === a.name
            const assetColor  = ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]
            return (
              <div
                key={a.name}
                onClick={() => setPortfolioHighlight(isHighlighted ? null : a.name)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 8px',
                  marginLeft: '-8px',
                  marginRight: '-8px',
                  borderRadius: '6px',
                  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  backgroundColor: isHighlighted ? 'rgba(255,255,255,0.04)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isHighlighted && (
                    <div style={{ width: '3px', height: '14px', borderRadius: '2px', backgroundColor: assetColor, flexShrink: 0 }} />
                  )}
                  <p style={{ fontSize: '12px', fontWeight: isHighlighted ? 700 : 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, color: isHighlighted ? assetColor : 'var(--text)' }}>{a.name}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', fontWeight: 600, margin: '0 0 3px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    ${a.current_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p style={{ fontSize: '11px', margin: 0, fontWeight: 600, color: a.pct_return >= 0 ? 'var(--positive)' : 'var(--negative)', fontVariantNumeric: 'tabular-nums' }}>
                    {a.pct_return >= 0 ? '+' : ''}{a.pct_return.toFixed(2)}%
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Asset Allocation */}
      <div>
        <p style={{ ...sectionLabel, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: '20px' }}>Allocation</p>
        <AllocationChart assets={assets} positions={positions} selected={selectedAsset} onSelect={setSelectedAsset} />
      </div>

      {/* Per-asset value over time */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ ...sectionLabel, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)' }}>
            {selectedAsset ? selectedAsset.toUpperCase() : 'Position Value Over Time'}
          </p>
          <RangeToggle range={posRange} onChange={setPosRange} />
        </div>
        <Plot
          data={assetLines}
          layout={{
            ...PLOT_BASE,
            showlegend: false,
            margin: { t: 8, r: 16, b: 16, l: 72 },
            xaxis: { gridcolor: 'rgba(255,255,255,0.04)', linecolor: 'transparent', tickfont: { size: 11 } },
            yaxis: { gridcolor: 'rgba(255,255,255,0.04)', linecolor: 'transparent', tickprefix: '$', tickformat: ',.0f', tickfont: { size: 11 }, autorange: true },
            hovermode: 'x unified',
            hoverlabel: { bgcolor: '#1a1a2e', bordercolor: 'rgba(0,212,170,0.3)', font: { color: '#fff', size: 12 } },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '300px' }}
          useResizeHandler
        />
      </div>

      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }} />

      <DrawdownChart />

      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }} />

      <SignalAccuracyChart />

      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)' }} />

      <SignalAccuracyScorecard />

    </div>
  )
}
