import { useQuery } from '@tanstack/react-query'
import { getSignalAccuracy } from '../api'

const MIN_SAMPLE = 4
const RADIUS = 32
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const sectionLabel: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.35)',
  margin: 0,
}

function arcColor(pct: number | null, lowSample: boolean): string {
  if (lowSample || pct === null) return 'rgba(255,255,255,0.15)'
  if (pct >= 70) return '#00d4aa'
  if (pct >= 50) return '#f59e0b'
  return '#ff4d4d'
}

function RingCard({ row, index }: { row: any; index: number }) {
  const pct: number | null = row.accuracy_pct
  const lowSample = row.total_signals > 0 && row.total_signals < MIN_SAMPLE
  const noData = row.total_signals === 0 || pct === null
  const color = arcColor(pct, lowSample)
  const fill = noData ? 0 : (pct! / 100) * CIRCUMFERENCE
  const animId = `arc-${row.asset_name}`

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        animation: `fadeSlideIn 0.4s ease-out both`,
        animationDelay: `${index * 80}ms`,
      }}
    >
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes drawArc-${row.asset_name} {
          from { stroke-dashoffset: ${CIRCUMFERENCE}; }
          to   { stroke-dashoffset: ${CIRCUMFERENCE - fill}; }
        }
        #${animId} {
          stroke-dashoffset: ${CIRCUMFERENCE - fill};
          animation: drawArc-${row.asset_name} 800ms ease-out both;
          animation-delay: ${index * 80 + 100}ms;
        }
      `}</style>

      <svg width="80" height="80" viewBox="0 0 80 80">
        {/* Track */}
        <circle
          cx="40" cy="40" r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="6"
        />
        {/* Arc */}
        {!noData && (
          <circle
            id={animId}
            cx="40" cy="40" r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            transform="rotate(-90 40 40)"
            style={{ strokeDashoffset: CIRCUMFERENCE }}
          />
        )}
        {/* Center text */}
        <text
          x="40" y="44"
          textAnchor="middle"
          fontSize="18"
          fontWeight="800"
          fontFamily="-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
          fill={noData ? 'rgba(255,255,255,0.2)' : color}
        >
          {noData ? '—' : `${Math.round(pct!)}%`}
        </text>
      </svg>

      <div style={{ textAlign: 'center' }}>
        <p style={{
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'rgba(255,255,255,0.7)',
          margin: '0 0 4px',
        }}>
          {row.asset_name}
        </p>
        <p style={{
          fontSize: '11px',
          color: 'rgba(255,255,255,0.35)',
          margin: 0,
        }}>
          {noData ? 'no data' : `${row.correct_signals} / ${row.total_signals} trades`}
        </p>
        {lowSample && (
          <p style={{ fontSize: '10px', color: '#f59e0b', margin: '3px 0 0' }}>
            low sample
          </p>
        )}
      </div>
    </div>
  )
}

export default function SignalAccuracyScorecard() {
  const { data = [] } = useQuery({ queryKey: ['signal-accuracy'], queryFn: getSignalAccuracy })

  const rows = data as any[]
  if (rows.length === 0) return null

  const qualifiedRows = rows.filter(r => r.total_signals >= MIN_SAMPLE && r.accuracy_pct !== null)
  const overallAccuracy = qualifiedRows.length > 0
    ? qualifiedRows.reduce((sum: number, r: any) => sum + r.accuracy_pct, 0) / qualifiedRows.length
    : null
  const hasExcluded = rows.some(r => r.total_signals > 0 && r.total_signals < MIN_SAMPLE)

  const firstRow = rows.slice(0, 4)
  const secondRow = rows.slice(4)

  return (
    <div>
      <p style={sectionLabel}>Signal Accuracy — By Asset</p>

      <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div style={{ display: 'flex', gap: '0', justifyContent: 'space-around' }}>
          {firstRow.map((row, i) => (
            <RingCard key={row.asset_name} row={row} index={i} />
          ))}
        </div>
        {secondRow.length > 0 && (
          <div style={{ display: 'flex', gap: '0', justifyContent: 'space-around', paddingLeft: `${(4 - secondRow.length) * 12.5}%`, paddingRight: `${(4 - secondRow.length) * 12.5}%` }}>
            {secondRow.map((row, i) => (
              <RingCard key={row.asset_name} row={row} index={firstRow.length + i} />
            ))}
          </div>
        )}
      </div>

      {overallAccuracy !== null && (
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '24px 0 0', textAlign: 'center' }}>
          Overall accuracy:{' '}
          <span style={{ color: 'rgba(255,255,255,0.75)' }}>{overallAccuracy.toFixed(1)}%</span>
          {hasExcluded && (
            <span style={{ color: 'rgba(255,255,255,0.25)', marginLeft: '6px' }}>
              (excludes assets with insufficient data)
            </span>
          )}
        </p>
      )}
    </div>
  )
}
