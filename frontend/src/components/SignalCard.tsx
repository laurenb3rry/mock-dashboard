type Signal = 'BUY' | 'SELL' | 'HOLD' | 'SHORT'

interface Props {
  assetName: string
  weight: number
  signal?: Signal
  fredValue?: number
}

const CONFIG: Record<Signal, { bg: string; border: string; labelColor: string; icon: string }> = {
  BUY:   { bg: 'rgba(0,212,170,0.07)',   border: 'rgba(0,212,170,0.25)',   labelColor: 'var(--positive)', icon: '↑' },
  SELL:  { bg: 'rgba(240,79,86,0.07)',   border: 'rgba(240,79,86,0.25)',   labelColor: 'var(--negative)', icon: '↓' },
  HOLD:  { bg: 'rgba(255,255,255,0.03)', border: 'var(--border)',           labelColor: 'var(--muted)',    icon: '—' },
  SHORT: { bg: 'rgba(245,166,35,0.07)',  border: 'rgba(245,166,35,0.25)',  labelColor: 'var(--warning)',  icon: '↙' },
}

const BLANK = { bg: 'rgba(255,255,255,0.03)', border: 'var(--border)' }

export default function SignalCard({ assetName, weight, signal, fredValue }: Props) {
  const cfg = signal ? CONFIG[signal] : null

  return (
    <div style={{
      backgroundColor: cfg ? cfg.bg : BLANK.bg,
      border: `1px solid ${cfg ? cfg.border : BLANK.border}`,
      borderRadius: '12px',
      padding: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text)' }}>
          {assetName}
        </span>
        {cfg && (
          <span style={{ fontSize: '12px', fontWeight: 700, color: cfg.labelColor }}>
            {cfg.icon} {signal}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--muted)' }}>FRED</span>
          <span style={{ color: 'var(--text)' }}>{fredValue !== undefined ? fredValue.toLocaleString() : '—'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--muted)' }}>Weight</span>
          <span style={{ color: 'var(--text)' }}>{(weight * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
}
