interface Trade {
  id: number
  trade_date: string
  asset_name: string
  signal: string
  price_at_trade: number | null
  confirmed: boolean
}

interface Props {
  trades: Trade[]
}

const SIGNAL_BADGE: Record<string, { color: string; bg: string }> = {
  BUY:   { color: '#00d4aa', bg: 'rgba(0,212,170,0.15)' },
  SELL:  { color: '#ff4d4d', bg: 'rgba(255,77,77,0.15)' },
  SHORT: { color: '#ffa500', bg: 'rgba(255,165,0,0.15)' },
  HOLD:  { color: 'rgba(255,255,255,0.5)', bg: 'rgba(255,255,255,0.08)' },
}

const headerStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.45)',
  padding: '0 0 12px 0',
  textAlign: 'left',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
}

export default function TradeTable({ trades }: Props) {
  if (trades.length === 0) {
    return <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>No trades yet.</p>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '28%' }} />
          <col style={{ width: '22%' }} />
          <col style={{ width: '20%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={headerStyle}>Date</th>
            <th style={headerStyle}>Asset</th>
            <th style={headerStyle}>Signal</th>
            <th style={{ ...headerStyle, textAlign: 'right' }}>Price</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((t, i) => {
            const badge = SIGNAL_BADGE[t.signal] ?? SIGNAL_BADGE.HOLD
            const isLast = i === trades.length - 1
            const rowBg = i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'
            const borderBottom = isLast ? 'none' : '1px solid rgba(255,255,255,0.05)'
            const cellStyle: React.CSSProperties = {
              height: '52px',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.85)',
              borderBottom,
              verticalAlign: 'middle',
              padding: '0',
            }
            return (
              <tr key={t.id} style={{ backgroundColor: rowBg }}>
                <td style={{ ...cellStyle, fontVariantNumeric: 'tabular-nums' }}>{t.trade_date}</td>
                <td style={{ ...cellStyle, fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '13px' }}>
                  {t.asset_name}
                </td>
                <td style={cellStyle}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '64px',
                    height: '24px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: badge.color,
                    backgroundColor: badge.bg,
                  }}>
                    {t.signal}
                  </span>
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {t.price_at_trade != null ? `$${t.price_at_trade.toLocaleString()}` : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
