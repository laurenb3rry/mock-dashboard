import { useQuery } from '@tanstack/react-query'
import { getTrades } from '../api'

const card: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '20px',
}

const th: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'rgba(255,255,255,0.45)',
  textAlign: 'left',
  padding: '0 16px 12px 0',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  whiteSpace: 'nowrap',
}

const ACTION_COLOR: Record<string, string> = {
  BUY:   '#00d4aa',
  SELL:  '#ff4d4d',
  SHORT: '#ffa500',
  HOLD:  'rgba(255,255,255,0.5)',
}

export default function Tables() {
  const { data: trades = [], isLoading } = useQuery({
    queryKey: ['trades'],
    queryFn: () => getTrades(),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '32px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>Tables</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '6px 0 0' }}>Full trade record</p>
      </div>

      {/* Trades table */}
      <div style={card}>
        <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 16px' }}>
          Trades
        </p>

        {isLoading ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Loading...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '13%' }} />  {/* Date */}
                <col style={{ width: '10%' }} />  {/* Asset */}
                <col style={{ width: '10%' }} />  {/* Action */}
                <col style={{ width: '15%' }} />  {/* Units Changed */}
                <col style={{ width: '15%' }} />  {/* Size ($) */}
                <col style={{ width: '15%' }} />  {/* Price */}
              </colgroup>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Asset</th>
                  <th style={th}>Action</th>
                  <th style={{ ...th, textAlign: 'right' }}>Units Changed</th>
                  <th style={{ ...th, textAlign: 'right' }}>Size ($)</th>
                  <th style={{ ...th, textAlign: 'right', paddingRight: 0 }}>Price</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t: any, i: number) => {
                  const isLast = i === trades.length - 1
                  const rowBg = i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent'
                  const border = isLast ? 'none' : '1px solid rgba(255,255,255,0.05)'
                  const cell: React.CSSProperties = {
                    height: '48px',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.8)',
                    borderBottom: border,
                    verticalAlign: 'middle',
                    padding: '0 16px 0 0',
                  }
                  const unitsColor = t.units_change == null
                    ? 'var(--muted)'
                    : t.units_change > 0
                      ? 'var(--positive)'
                      : 'var(--negative)'

                  return (
                    <tr key={t.id} style={{ backgroundColor: rowBg }}>
                      <td style={{ ...cell, fontVariantNumeric: 'tabular-nums', color: 'var(--muted)' }}>
                        {t.trade_date}
                      </td>
                      <td style={{ ...cell, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px' }}>
                        {t.asset_name}
                      </td>
                      <td style={{ ...cell, fontWeight: 600, color: ACTION_COLOR[t.action_taken] ?? 'var(--muted)' }}>
                        {t.action_taken ?? '—'}
                      </td>
                      <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: unitsColor }}>
                        {t.units_change != null
                          ? `${t.units_change > 0 ? '+' : ''}${t.units_change.toFixed(4)}`
                          : '—'}
                      </td>
                      <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {t.position_size != null ? `$${t.position_size.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingRight: 0 }}>
                        {t.price_at_trade != null ? `$${t.price_at_trade.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
