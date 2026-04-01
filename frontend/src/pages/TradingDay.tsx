import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { runStrategy, getLatestStrategy, confirmTrades } from '../api'
import SignalCard from '../components/SignalCard'

interface Signal {
  asset_name: string
  signal: 'BUY' | 'SELL' | 'HOLD' | 'SHORT'
  fred_value: number
  weight: number
  trade_id?: number
}

const card: React.CSSProperties = {
  backgroundColor: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: '12px',
  padding: '28px',
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: '4px',
}

const ACTIONS: Signal['signal'][] = ['BUY', 'SELL', 'HOLD', 'SHORT']

const ACTION_SELECTED: Record<string, React.CSSProperties> = {
  BUY:   { backgroundColor: 'var(--positive)', color: '#0a1a17', fontWeight: 700 },
  SELL:  { backgroundColor: 'var(--negative)', color: '#fff',    fontWeight: 700 },
  HOLD:  { backgroundColor: 'rgba(255,255,255,0.15)', color: 'var(--text)', fontWeight: 700 },
  SHORT: { backgroundColor: 'var(--warning)',  color: '#1a1000', fontWeight: 700 },
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  padding: '7px 10px',
  color: 'var(--text)',
  fontSize: '13px',
  width: '100%',
  boxSizing: 'border-box',
}

export default function TradingDay() {
  const qc = useQueryClient()
  const [runResult, setRunResult] = useState<{ run_date: string; signals: Signal[] } | null>(null)
  const [inputs, setInputs] = useState<Record<number, { action: string; size: string; price: string }>>({})
  const [done, setDone] = useState(false)

  const { data: latest } = useQuery({
    queryKey: ['strategy-latest'],
    queryFn: getLatestStrategy,
  })

  const { mutate: doRun, isPending: running } = useMutation({
    mutationFn: runStrategy,
    onSuccess: (data) => {
      setRunResult(data)
      setDone(false)
      setInputs({})
      qc.invalidateQueries({ queryKey: ['trades'] })
    },
  })

  const { mutate: doConfirm, isPending: confirming } = useMutation({
    mutationFn: confirmTrades,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] })
      qc.invalidateQueries({ queryKey: ['portfolio-current'] })
      setRunResult(null)  // reset tiles to blank state
      setDone(true)
    },
  })

  // hasRun is true only when the user has clicked Run Strategy this session
  const hasRun = runResult !== null

  // Always show the 7 cards using latest for names+weights, runResult for signal data
  const signals: Signal[] = runResult?.signals ?? latest?.signals ?? []

  // Last run date shown below the button
  const lastRunDate = (runResult ?? latest)?.run_date

  function setInput(tradeId: number, field: 'action' | 'size' | 'price', value: string) {
    setInputs(prev => ({ ...prev, [tradeId]: { ...prev[tradeId], [field]: value } }))
  }

  function handleConfirm() {
    const payload = signals
      .filter(s => s.trade_id != null)
      .map(s => {
        const inp = inputs[s.trade_id!] ?? {}
        return {
          trade_id:       s.trade_id!,
          action_taken:   inp.action || s.signal,
          position_size:  parseFloat(inp.size || '0'),
          price_at_trade: parseFloat(inp.price || '0'),
        }
      })
    doConfirm(payload)
  }

  return (
    <div style={{ paddingTop: '32px' }}>

      {/* Page header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, color: 'var(--text)' }}>Trading Day</h1>
        <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '8px 0 0' }}>
          Run the strategy, check signals, execute trades on your platform, then confirm here.
        </p>
      </div>

      {/* Run strategy button */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
        <button
          onClick={() => doRun()}
          disabled={running}
          style={{
            padding: '10px 28px',
            backgroundColor: running ? 'rgba(0,212,170,0.4)' : 'var(--accent)',
            color: '#0a1a17',
            fontWeight: 700,
            fontSize: '13px',
            border: 'none',
            borderRadius: '8px',
            cursor: running ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
            letterSpacing: '0.03em',
          }}
        >
          {running ? 'Running...' : 'Run Strategy'}
        </button>
        {lastRunDate && (
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>Last run: {lastRunDate}</p>
        )}
      </div>

      {/* Signal cards — always shown once asset data is available, blank until run */}
      {signals.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', maxWidth: '670px', margin: '0 auto' }}>
            {signals.map(s => (
              <div key={s.asset_name} style={{ width: '160px', flexShrink: 0 }}>
                <SignalCard
                  assetName={s.asset_name}
                  weight={s.weight}
                  signal={hasRun ? s.signal : undefined}
                  fredValue={hasRun ? s.fred_value : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm trades — shown once asset data exists, action buttons blank until run */}
      {signals.length > 0 && !done && (
        <div style={{ ...card, maxWidth: '720px', margin: '20px auto 0' }}>
          <p style={sectionLabel}>Confirm Trades</p>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '6px 0 24px' }}>
            After executing on your platform, enter what you actually did.
          </p>

          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '12px', marginBottom: '10px', padding: '0 2px' }}>
            {['Asset', 'Action', 'Size (total $)', 'Price (per unit)'].map(h => (
              <span key={h} style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--dim)' }}>
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {signals.map(s => {
              const inp = inputs[s.trade_id ?? 0] ?? {}
              // Only pre-select action after run; otherwise no button is highlighted
              const selected = hasRun ? (inp.action || s.signal) as Signal['signal'] : null
              return (
                <div key={s.asset_name} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {s.asset_name}
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {ACTIONS.map(action => (
                      <button
                        key={action}
                        onClick={() => s.trade_id && setInput(s.trade_id, 'action', action)}
                        style={{
                          flex: 1,
                          padding: '6px 0',
                          fontSize: '11px',
                          fontWeight: 500,
                          borderRadius: '5px',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.12s',
                          ...(selected === action
                            ? ACTION_SELECTED[action]
                            : { backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--dim)' }
                          ),
                        }}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={inp.size ?? ''}
                    onChange={e => s.trade_id && setInput(s.trade_id, 'size', e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={inp.price ?? ''}
                    onChange={e => s.trade_id && setInput(s.trade_id, 'price', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              padding: '10px 24px',
              backgroundColor: confirming ? 'rgba(0,212,170,0.4)' : 'var(--accent)',
              color: '#0a1a17',
              fontWeight: 700,
              fontSize: '13px',
              border: 'none',
              borderRadius: '8px',
              cursor: confirming ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {confirming ? 'Saving...' : 'Confirm Trades'}
          </button>
          </div>
        </div>
      )}

      {done && (
        <div style={{
          backgroundColor: 'rgba(0,212,170,0.07)',
          border: '1px solid rgba(0,212,170,0.25)',
          borderRadius: '12px',
          padding: '16px 24px',
          color: 'var(--positive)',
          fontSize: '13px',
          fontWeight: 600,
          textAlign: 'center',
          maxWidth: '720px',
          margin: '20px auto 0',
        }}>
          Trades confirmed and saved.
        </div>
      )}
    </div>
  )
}
