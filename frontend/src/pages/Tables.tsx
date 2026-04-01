import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTrades, getStrategyEvaluations } from '../api'

const ASSET_ORDER = ['gold', 'btc', 'qqq', 'asset4', 'asset5', 'asset6', 'asset7']

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

interface CellData { signal: string; confirmed: boolean; ndr: number | null }
interface TooltipState { x: number; y: number; content: React.ReactNode }

function SignalCell({ cell, asset, dateStr }: { cell: CellData | undefined; asset: string; dateStr: string }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  if (!cell) return <td style={{ width: 90, padding: '0 4px' }} />

  const { signal, confirmed, ndr } = cell
  const pending = ndr == null || !confirmed
  const correct = !pending && checkCorrect(signal, ndr!)

  const bg     = pending ? 'rgba(255,255,255,0.06)' : correct ? 'rgba(0,212,170,0.18)' : 'rgba(255,77,77,0.18)'
  const border = pending ? '1px solid transparent'  : correct ? '1px solid rgba(0,212,170,0.3)' : '1px solid rgba(255,77,77,0.3)'
  const color  = pending ? 'rgba(255,255,255,0.5)'  : correct ? '#00d4aa' : '#ff4d4d'
  const result = pending ? 'Pending' : correct ? 'Correct' : 'Incorrect'
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
          backgroundColor: '#1a1a2e',
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

export default function SignalResultsTable() {
  const { data: tradesRaw = [] } = useQuery({ queryKey: ['trades'], queryFn: () => getTrades() })
  const { data: evalsRaw  = [] } = useQuery({ queryKey: ['strategy-evaluations'], queryFn: getStrategyEvaluations })

  // Build cell lookup: date -> asset -> CellData
  console.log('[SignalResultsTable] sample trade:', (tradesRaw as any[])[0])
  const cellMap: Record<string, Record<string, CellData>> = {}
  for (const t of tradesRaw as any[]) {
    if (!cellMap[t.trade_date]) cellMap[t.trade_date] = {}
    cellMap[t.trade_date][t.asset_name] = { signal: t.signal, confirmed: t.confirmed, ndr: t.next_trading_day_return ?? null }
  }

  // Build eval lookup: date -> win_rate
  const evalMap: Record<string, number | null> = {}
  for (const e of evalsRaw as any[]) evalMap[e.eval_date] = e.win_rate ?? null

  // Unique dates descending
  const dates = Array.from(new Set((tradesRaw as any[]).map((t: any) => t.trade_date)))
    .sort((a, b) => (b as string).localeCompare(a as string)) as string[]

  // Summary stats
  const validEvals = (evalsRaw as any[]).filter((e: any) => e.win_rate != null)
  const overallWinRate = validEvals.length > 0
    ? validEvals.reduce((sum: number, e: any) => sum + e.win_rate, 0) / validEvals.length
    : null
  const best  = validEvals.length > 0 ? validEvals.reduce((a: any, b: any) => a.win_rate >= b.win_rate ? a : b) : null
  const worst = validEvals.length > 0 ? validEvals.reduce((a: any, b: any) => a.win_rate <= b.win_rate ? a : b) : null

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
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: '0 0 8px' }}>Signal Results</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0 }}>
          Per-trading-day breakdown of strategy signal accuracy
        </p>
      </div>

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
                  <td style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', width: 120, paddingRight: 16, whiteSpace: 'nowrap', verticalAlign: 'middle', height: 56 }}>
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

      {overallWinRate != null && (
        <div style={{ display: 'flex', gap: 48, marginTop: 32 }}>
          <div>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Overall win rate: </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: overallWinRate >= 60 ? '#00d4aa' : '#ff4d4d' }}>
              {overallWinRate.toFixed(1)}%
            </span>
          </div>
          {best && (
            <div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Best trading day: </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                {best.win_rate.toFixed(1)}% — {formatDate(best.eval_date)}
              </span>
            </div>
          )}
          {worst && (
            <div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Worst trading day: </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                {worst.win_rate.toFixed(1)}% — {formatDate(worst.eval_date)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
