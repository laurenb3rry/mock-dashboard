import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTrades, getStrategyEvaluations, getSignalAccuracy } from '../api'

const ASSET_ORDER = ['gold', 'btc', 'qqq', 'asset4', 'asset5', 'asset6', 'asset7']

// The table header th uses padding: '0 4px 16px' with 11px text (~14px line-height).
// Total rendered thead height ≈ 14 + 16 = 30px. Right panel paddingTop matches this
// so its first asset row aligns with the table's first data row.
const THEAD_HEIGHT = 30

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatPct(v: number | null): string {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

function checkCorrect(signal: string, ndr: number): boolean {
  return (
    (signal === 'BUY'  && ndr > 0) ||
    (signal === 'SELL' && ndr < 0) ||
    (signal === 'SHORT' && ndr < 0) ||
    (signal === 'HOLD')
  )
}

function winRateColor(pct: number): string {
  if (pct >= 70) return '#00d4aa'
  if (pct >= 50) return '#f59e0b'
  return '#ff4d4d'
}

function arcColor(pct: number | null, noData: boolean): string {
  if (noData || pct === null) return 'rgba(255,255,255,0.08)'
  if (pct >= 70) return '#00d4aa'
  if (pct >= 50) return '#f59e0b'
  return '#ff4d4d'
}

interface CellData { signal: string; confirmed: boolean; ndr: number | null }
interface TooltipState { x: number; y: number; content: React.ReactNode }

function SignalCell({ cell, asset, dateStr }: { cell: CellData | undefined; asset: string; dateStr: string }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  if (!cell) return <td style={{ width: 90, padding: '0 4px' }} />

  const { signal, confirmed, ndr } = cell
  const pending     = ndr == null || !confirmed
  const correct     = !pending && checkCorrect(signal, ndr!)
  const bg          = pending ? 'rgba(255,255,255,0.06)' : correct ? 'rgba(0,212,170,0.18)' : 'rgba(255,77,77,0.18)'
  const border      = pending ? '1px solid transparent'  : correct ? '1px solid rgba(0,212,170,0.3)' : '1px solid rgba(255,77,77,0.3)'
  const color       = pending ? 'rgba(255,255,255,0.5)'  : correct ? '#00d4aa' : '#ff4d4d'
  const result      = pending ? 'Pending' : correct ? 'Correct' : 'Incorrect'
  const resultColor = pending ? 'rgba(255,255,255,0.4)' : correct ? '#00d4aa' : '#ff4d4d'

  return (
    <td style={{ width: 90, padding: '0 4px', verticalAlign: 'middle' }}>
      <div
        style={{ width: 90, height: 44, borderRadius: 6, backgroundColor: bg, border, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}
        onMouseEnter={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          setTooltip({
            x: rect.left + rect.width / 2,
            y: rect.top,
            content: (
              <>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{asset.toUpperCase()} — {formatDate(dateStr)}</div>
                <div style={{ color: 'rgba(255,255,255,0.6)' }}>Signal: <span style={{ color: '#fff' }}>{signal}</span></div>
                <div style={{ color: 'rgba(255,255,255,0.6)' }}>Result: <span style={{ color: resultColor }}>{result}</span></div>
                <div style={{ color: 'rgba(255,255,255,0.6)' }}>Next day: <span style={{ color: '#fff' }}>{formatPct(ndr)}</span></div>
              </>
            ),
          })
        }}
        onMouseLeave={() => setTooltip(null)}
      >
        <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color }}>{signal}</span>
      </div>

      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y - 8,
          transform: 'translate(-50%, -100%)',
          backgroundColor: '#16161f',
          border: '1px solid rgba(0,212,170,0.3)',
          color: '#fff',
          fontSize: 12,
          padding: '10px',
          borderRadius: 8,
          whiteSpace: 'nowrap',
          zIndex: 1000,
          pointerEvents: 'none',
          lineHeight: 1.6,
        }}>
          {tooltip.content}
        </div>
      )}
    </td>
  )
}

// ── Right panel ────────────────────────────────────────────────────────────

const RING_SIZE = 48
const RING_R    = 20
const RING_CIRC = 2 * Math.PI * RING_R

function AccuracyRow({ row, index, isLast }: { row: any; index: number; isLast: boolean }) {
  const pct: number | null = row.accuracy_pct
  const noData = row.total_signals === 0 || pct === null
  const color  = arcColor(pct, noData)
  const fill   = noData ? 0 : (pct! / 100) * RING_CIRC
  const animId = `acc-arc-${row.asset_name}`

  return (
    <div style={{
      height: 60,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
    }}>
      <style>{`
        @keyframes drawAccArc-${row.asset_name} {
          from { stroke-dashoffset: ${RING_CIRC}; }
          to   { stroke-dashoffset: ${RING_CIRC - fill}; }
        }
        #${animId} {
          stroke-dashoffset: ${RING_CIRC - fill};
          animation: drawAccArc-${row.asset_name} 700ms ease-out both;
          animation-delay: ${index * 60 + 100}ms;
        }
      `}</style>

      {/* Ring */}
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`} style={{ flexShrink: 0 }}>
        <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        {!noData && (
          <circle
            id={animId}
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
            fill="none" stroke={color} strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            style={{ strokeDashoffset: RING_CIRC }}
          />
        )}
      </svg>

      {/* Name + trade count */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {row.asset_name}
        </p>
        <p style={{ fontSize: 11, margin: 0, color: 'rgba(255,255,255,0.3)' }}>
          {noData ? 'no data' : `${row.correct_signals} / ${row.total_signals} trades`}
        </p>
      </div>

      {/* Percentage — fixed width, right-aligned, no auto margin */}
      <p style={{
        fontSize: 16,
        fontWeight: 700,
        margin: 0,
        width: 48,
        textAlign: 'right',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
        color: noData ? 'rgba(255,255,255,0.2)' : color,
      }}>
        {noData ? '—' : `${Math.round(pct!)}%`}
      </p>
    </div>
  )
}

function AssetAccuracyPanel() {
  const { data = [] } = useQuery({ queryKey: ['signal-accuracy'], queryFn: getSignalAccuracy })
  const rows = data as any[]
  if (rows.length === 0) return null

  const sorted = [...rows].sort((a, b) => {
    if (a.accuracy_pct === null && b.accuracy_pct === null) return 0
    if (a.accuracy_pct === null) return 1
    if (b.accuracy_pct === null) return -1
    return b.accuracy_pct - a.accuracy_pct
  })

  return (
    // paddingTop = THEAD_HEIGHT so first asset row aligns with first data row
    <div style={{ width: 220, flexShrink: 0, paddingTop: THEAD_HEIGHT }}>
      {sorted.map((row, i) => (
        <AccuracyRow key={row.asset_name} row={row} index={i} isLast={i === sorted.length - 1} />
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function SignalResultsTable() {
  const { data: tradesRaw = [] } = useQuery({ queryKey: ['trades'], queryFn: () => getTrades() })
  const { data: evalsRaw  = [] } = useQuery({ queryKey: ['strategy-evaluations'], queryFn: getStrategyEvaluations })

  console.log('[SignalResultsTable] sample trade:', (tradesRaw as any[])[0])

  const cellMap: Record<string, Record<string, CellData>> = {}
  for (const t of tradesRaw as any[]) {
    if (!cellMap[t.trade_date]) cellMap[t.trade_date] = {}
    cellMap[t.trade_date][t.asset_name] = { signal: t.signal, confirmed: t.confirmed, ndr: t.next_trading_day_return ?? null }
  }

  const evalMap: Record<string, number | null> = {}
  for (const e of evalsRaw as any[]) evalMap[e.eval_date] = e.win_rate ?? null

  const dates = Array.from(new Set((tradesRaw as any[]).map((t: any) => t.trade_date)))
    .sort((a, b) => (b as string).localeCompare(a as string)) as string[]

  const validEvals = (evalsRaw as any[]).filter((e: any) => e.win_rate != null)
  const overallWinRate = validEvals.length > 0
    ? validEvals.reduce((sum: number, e: any) => sum + e.win_rate, 0) / validEvals.length
    : null

  const headerStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'rgba(255,255,255,0.4)',
    padding: '0 4px 16px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ paddingTop: 24 }}>

      {/* Page header — sits above the grid, spans left column width only */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Signal Results</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            Per-trading-day breakdown of strategy signal accuracy
          </p>
        </div>

        {overallWinRate != null && (
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 4px' }}>
              Overall Win Rate
            </p>
            <p style={{ fontSize: 32, fontWeight: 800, margin: 0, lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: winRateColor(overallWinRate) }}>
              {overallWinRate.toFixed(1)}%
            </p>
          </div>
        )}
      </div>

      {/* Grid: left table + right panel. Gap 48px. Right panel pads down by thead height. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 48, alignItems: 'start' }}>

        {/* Left — signal results table */}
        <div style={{ minWidth: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ ...headerStyle, textAlign: 'left', width: 120, paddingRight: 16 }}>Date</th>
                  {ASSET_ORDER.map(a => <th key={a} style={headerStyle}>{a.toUpperCase()}</th>)}
                  <th style={{ ...headerStyle, width: 100 }}>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {dates.map(dateStr => {
                  const winRate = evalMap[dateStr] ?? null
                  return (
                    <tr key={dateStr} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', width: 120, paddingRight: 16, whiteSpace: 'nowrap', verticalAlign: 'middle', height: 60 }}>
                        {formatDate(dateStr)}
                      </td>
                      {ASSET_ORDER.map(asset => (
                        <SignalCell key={asset} cell={cellMap[dateStr]?.[asset]} asset={asset} dateStr={dateStr} />
                      ))}
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', width: 100 }}>
                        {winRate != null
                          ? <span style={{ fontSize: 14, fontWeight: 700, color: winRate >= 60 ? '#00d4aa' : '#ff4d4d' }}>{winRate.toFixed(1)}%</span>
                          : <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>—</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right — asset accuracy panel */}
        <AssetAccuracyPanel />

      </div>
    </div>
  )
}
