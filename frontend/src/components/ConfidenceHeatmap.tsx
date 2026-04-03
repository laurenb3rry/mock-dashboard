import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getConfidenceHeatmap } from '../api'

const ASSET_ORDER = ['gold', 'btc', 'qqq', 'asset4', 'asset5', 'asset6', 'asset7']

const LABEL_COL_WIDTH = 60
const CELL_WIDTH      = 48
const CELL_HEIGHT     = 40

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.3)',
  margin: 0,
}

function cellBg(confidence: number | null): string {
  if (confidence == null) return 'rgba(255,255,255,0.08)'
  if (confidence >= 0.8)  return 'rgba(0,212,170,0.9)'
  if (confidence >= 0.65) return 'rgba(0,212,170,0.55)'
  if (confidence >= 0.5)  return 'rgba(0,212,170,0.25)'
  return 'rgba(255,255,255,0.08)'
}

function signalBadge(signal: string): string {
  if (signal === 'BUY')   return 'B'
  if (signal === 'SELL')  return 'S'
  if (signal === 'HOLD')  return 'H'
  if (signal === 'SHORT') return 'Sh'
  return '?'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface TooltipState { x: number; y: number; content: string }

export default function ConfidenceHeatmap() {
  const { data = [] } = useQuery({ queryKey: ['confidence-heatmap'], queryFn: getConfidenceHeatmap })
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  if ((data as any[]).length === 0) return null

  // Extract unique dates in order
  const uniqueDates: string[] = []
  for (const cell of data as any[]) {
    if (!uniqueDates.includes(cell.trade_date)) uniqueDates.push(cell.trade_date)
  }

  // Build lookup map
  const cellMap: Record<string, Record<string, any>> = {}
  for (const cell of data as any[]) {
    if (!cellMap[cell.trade_date]) cellMap[cell.trade_date] = {}
    cellMap[cell.trade_date][cell.asset_name] = cell
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
        <p style={sectionLabel}>Strategy Confidence Heatmap</p>
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
              backgroundColor: '#16161f',
              border: '1px solid rgba(0,212,170,0.3)',
              color: '#fff',
              fontSize: '11px',
              padding: '8px 10px',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
              zIndex: 10,
              pointerEvents: 'none',
            }}>
              Color intensity = signal confidence. Brighter = stronger conviction.
            </div>
          )}
        </div>
      </div>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: '0 0 16px' }}>
        Color intensity = signal confidence. Brighter = stronger conviction.
      </p>

      {/* Color scale legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingLeft: LABEL_COL_WIDTH }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>Low confidence</span>
        <div style={{
          width: '200px',
          height: '8px',
          borderRadius: '4px',
          background: 'linear-gradient(to right, rgba(255,255,255,0.08), rgba(0,212,170,0.9))',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>High confidence</span>
      </div>

      {/* Grid */}
      <div style={{ position: 'relative', overflowX: 'auto' }}>
        {ASSET_ORDER.map((asset) => (
          <div key={asset} style={{ display: 'flex', height: CELL_HEIGHT }}>
            {/* Asset label */}
            <div style={{
              width: LABEL_COL_WIDTH,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: '8px',
            }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)' }}>
                {asset}
              </span>
            </div>

            {/* Cells */}
            {uniqueDates.map((dateStr) => {
              const cell = cellMap[dateStr]?.[asset]
              if (!cell) {
                return (
                  <div key={dateStr} style={{ width: CELL_WIDTH, height: CELL_HEIGHT, border: '2px solid #0a0a0f' }} />
                )
              }
              const { signal, signal_confidence: confidence } = cell
              return (
                <div
                  key={dateStr}
                  style={{
                    width: CELL_WIDTH,
                    height: CELL_HEIGHT,
                    backgroundColor: cellBg(confidence),
                    border: '2px solid #0a0a0f',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'default',
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltip({
                      x: rect.left + CELL_WIDTH / 2,
                      y: rect.top,
                      content: `${asset.toUpperCase()} — ${formatDate(dateStr)} — ${signal} — ${confidence != null ? Math.round(confidence * 100) : '?'}% confidence`,
                    })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', userSelect: 'none' }}>
                    {signalBadge(signal)}
                  </span>
                </div>
              )
            })}
          </div>
        ))}

        {/* Date labels */}
        <div style={{ display: 'flex', marginTop: '6px' }}>
          <div style={{ width: LABEL_COL_WIDTH, flexShrink: 0 }} />
          {uniqueDates.map((dateStr) => (
            <div key={dateStr} style={{ width: CELL_WIDTH, flexShrink: 0, display: 'flex', justifyContent: 'center', overflow: 'visible' }}>
              <span style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.4)',
                display: 'block',
                transform: 'rotate(45deg)',
                transformOrigin: 'left top',
                whiteSpace: 'nowrap',
                marginLeft: '14px',
              }}>
                {formatDate(dateStr)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y - 52,
          transform: 'translateX(-50%)',
          backgroundColor: '#16161f',
          border: '1px solid rgba(0,212,170,0.3)',
          color: '#fff',
          fontSize: '12px',
          padding: '8px 10px',
          borderRadius: '8px',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          pointerEvents: 'none',
        }}>
          {tooltip.content}
        </div>
      )}
    </div>
  )
}
