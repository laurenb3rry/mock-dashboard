import { useQuery } from '@tanstack/react-query'
import { getSignalAccuracy } from '../api'

const MIN_SAMPLE = 4

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  margin: 0,
}

function barColor(pct: number | null): string {
  if (pct === null) return 'rgba(255,255,255,0.12)'
  if (pct >= 70)   return '#00d4aa'
  if (pct >= 50)   return 'rgba(0,212,170,0.5)'
  return '#ff4d4d'
}

export default function SignalAccuracyChart() {
  const { data = [] } = useQuery({ queryKey: ['signal-accuracy'], queryFn: getSignalAccuracy })

  const qualifiedAssets = (data as any[]).filter(
    a => a.total_signals >= MIN_SAMPLE && a.accuracy_pct !== null
  )
  const overallAccuracy = qualifiedAssets.length > 0
    ? qualifiedAssets.reduce((sum: number, a: any) => sum + a.accuracy_pct, 0) / qualifiedAssets.length
    : null
  const hasExcluded = (data as any[]).some(
    a => a.total_signals > 0 && a.total_signals < MIN_SAMPLE
  )

  return (
    <div>
      <p style={sectionLabel}>Signal Accuracy</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        {(data as any[]).map((a: any) => {
          const hasData    = a.total_signals > 0 && a.accuracy_pct !== null
          const lowSample  = hasData && a.total_signals < MIN_SAMPLE
          const pct: number | null = a.accuracy_pct

          return (
            <div
              key={a.asset_name}
              title={lowSample ? 'Insufficient sample size — fewer than 4 trades recorded.' : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: lowSample ? 0.4 : 1 }}
            >
              <span style={{
                width: '60px', flexShrink: 0,
                fontSize: '11px', fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)',
              }}>
                {a.asset_name}
              </span>
              <div style={{ flex: 1, height: '24px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: hasData ? `${pct}%` : '0%',
                  backgroundColor: barColor(pct),
                  borderRadius: '3px',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{
                width: '130px', flexShrink: 0,
                fontSize: '11px', textAlign: 'right',
                color: hasData ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)',
              }}>
                {hasData
                  ? <>{pct?.toFixed(0)}% ({a.correct_signals}/{a.total_signals}){lowSample && <span style={{ color: '#f59e0b', marginLeft: '4px' }}>⚠</span>}</>
                  : 'insufficient data'
                }
              </span>
            </div>
          )
        })}
      </div>

      {overallAccuracy !== null && (
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '16px 0 0' }}>
          Overall accuracy:{' '}
          <span style={{ color: 'rgba(255,255,255,0.75)' }}>{overallAccuracy.toFixed(1)}%</span>
          {hasExcluded && (
            <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: '6px' }}>
              (excludes assets with insufficient data)
            </span>
          )}
        </p>
      )}
      {overallAccuracy === null && data.length > 0 && (
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', margin: '16px 0 0' }}>
          Accuracy data will populate after trades are confirmed and next-day returns are backfilled.
        </p>
      )}
    </div>
  )
}
