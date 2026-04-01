import { useState } from 'react'
import { ALLOCATION_COLORS } from '../constants'

const SEGMENT_COLORS = ALLOCATION_COLORS

interface Props {
  assets: any[]    // { name, allocation_pct, current_value, ... }
  positions: any[] // { asset_name, units_held, current_price, current_value }
  selected?: string | null
  onSelect?: (name: string | null) => void
}

interface TooltipPos { x: number; y: number }

export default function AllocationChart({ assets, positions, selected, onSelect }: Props) {
  const [hovered, setHovered]       = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<TooltipPos>({ x: 0, y: 0 })

  const posMap: Record<string, any> = {}
  for (const p of positions) posMap[p.asset_name] = p

  const segmentOpacity = (name: string) => {
    if (selected) return selected === name ? 1 : 0.3
    return hovered === name ? 1 : hovered ? 0.5 : 0.85
  }

  return (
    <div>
      {/* Single stacked bar */}
      <div style={{ display: 'flex', width: '100%', height: '32px', borderRadius: '4px', overflow: 'hidden', gap: '2px' }}>
        {assets.map((a: any, i: number) => (
          <div
            key={a.name}
            style={{
              width: `${a.allocation_pct}%`,
              height: '100%',
              backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
              opacity: segmentOpacity(a.name),
              flexShrink: 0,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onClick={() => onSelect?.(selected === a.name ? null : a.name)}
            onMouseEnter={(e) => { setHovered(a.name); setTooltipPos({ x: e.clientX, y: e.clientY }) }}
            onMouseMove={(e)  => setTooltipPos({ x: e.clientX, y: e.clientY })}
            onMouseLeave={()  => setHovered(null)}
          />
        ))}
      </div>

      {/* Labels — each centered under its segment, mirroring bar widths */}
      <div style={{ display: 'flex', width: '100%', gap: '2px', marginTop: '8px' }}>
        {assets.map((a: any, i: number) => (
          <div
            key={a.name}
            style={{ width: `${a.allocation_pct}%`, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', overflow: 'hidden' }}
          >
            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: selected === a.name ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
              {a.name}
            </span>
            <span style={{ fontSize: '10px', color: selected === a.name ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
              {a.allocation_pct.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {/* Tooltip */}
      {hovered && (() => {
        const a   = assets.find((x: any) => x.name === hovered)
        const pos = posMap[hovered] ?? {}
        const idx = assets.findIndex((x: any) => x.name === hovered)
        if (!a) return null
        return (
          <div style={{
            position: 'fixed',
            left: tooltipPos.x + 18 + 190 > window.innerWidth ? tooltipPos.x - 208 : tooltipPos.x + 18,
            top:  tooltipPos.y + 12,
            zIndex: 100,
            backgroundColor: '#1a1a2e',
            border: '1px solid rgba(0,212,170,0.3)',
            borderRadius: '8px',
            padding: '12px',
            color: '#fff',
            fontSize: '12px',
            lineHeight: 1.7,
            pointerEvents: 'none',
            minWidth: '190px',
          }}>
            <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length] }}>
              {a.name}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Units held</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {pos.units_held != null ? pos.units_held.toFixed(4) : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Price</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {pos.current_price != null ? `$${pos.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Value</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {a.current_value != null ? `$${a.current_value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
              </span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
