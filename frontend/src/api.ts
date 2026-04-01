// Every fetch call to the backend lives here.
// Pages and components import from this file — no raw fetch calls elsewhere.

export async function runStrategy() {
  const res = await fetch('/api/strategy/run', { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getLatestStrategy() {
  const res = await fetch('/api/strategy/latest')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getTrades(asset?: string, from?: string, to?: string) {
  const params = new URLSearchParams()
  if (asset) params.set('asset', asset)
  if (from)  params.set('from', from)
  if (to)    params.set('to', to)
  const qs = params.toString() ? `?${params}` : ''
  const res = await fetch(`/api/trades${qs}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function confirmTrades(
  trades: Array<{ trade_id: number; action_taken: string; position_size: number; price_at_trade: number }>
) {
  const res = await fetch('/api/trades/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trades),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getPortfolioHistory() {
  const res = await fetch('/api/portfolio/history')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getPortfolioCurrent() {
  const res = await fetch('/api/portfolio/current')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getAssets() {
  const res = await fetch('/api/assets')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getBenchmark() {
  const res = await fetch('/api/portfolio/benchmark')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getDrawdown() {
  const res = await fetch('/api/portfolio/drawdown')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getSignalAccuracy() {
  const res = await fetch('/api/trades/signal-accuracy')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getStrategyEvaluations() {
  const res = await fetch('/api/strategy/evaluations')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getConfidenceHeatmap() {
  const res = await fetch('/api/trades/confidence-heatmap')
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
