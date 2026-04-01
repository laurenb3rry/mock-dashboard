import json
import math
import random
import statistics as _stats
from datetime import date, timedelta
from typing import Any, Optional
from pathlib import Path

from fastapi import FastAPI, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import (
    get_db, create_tables,
    Trade, FredSnapshot, PortfolioHistory, BenchmarkHistory, StrategyEvaluation,
)
from strategy import MasterStrategy
from fred_client import get_fred_value

# Load model store
with open(Path(__file__).parent / "model_store.json") as f:
    MODEL_STORE = json.load(f)

ASSETS        = MODEL_STORE["assets"]
INITIAL_VALUE = MODEL_STORE["initial_portfolio_value"]

create_tables()

app = FastAPI(title="Trading Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

strategy = MasterStrategy()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_confidence(signal: str) -> float:
    """Generate a mock signal confidence value. BACKFILL: replace with real cvxpy output."""
    if signal in ("BUY", "SHORT"):
        base = random.uniform(0.65, 0.95)
    elif signal == "HOLD":
        base = random.uniform(0.45, 0.65)
    else:  # SELL
        base = random.uniform(0.45, 0.95)
    return round(min(0.99, max(0.01, base + random.uniform(-0.015, 0.015))), 3)


# Tickers for real assets in yfinance
REAL_ASSET_TICKERS = {
    "gold": "GC=F",
    "btc":  "BTC-USD",
    "qqq":  "QQQ",
}


def _build_positions(db: Session) -> list[dict]:
    """Compute current positions from confirmed trades and live prices."""
    import yfinance as yf

    latest_ph = (
        db.query(PortfolioHistory)
        .order_by(PortfolioHistory.record_date.desc())
        .first()
    )
    prev_pos: dict[str, dict] = {}
    if latest_ph and latest_ph.positions_json:
        for p in json.loads(latest_ph.positions_json):
            prev_pos[p["asset_name"]] = p

    positions = []
    for asset in ASSETS:
        name = asset["name"]

        # avg_entry_price: from most recent portfolio_history, else first confirmed trade price
        if name in prev_pos:
            avg_entry_price = prev_pos[name]["avg_entry_price"]
        else:
            first_trade = (
                db.query(Trade)
                .filter(Trade.asset_name == name, Trade.confirmed == True,  # noqa: E712
                        Trade.price_at_trade != None)  # noqa: E711
                .order_by(Trade.trade_date)
                .first()
            )
            avg_entry_price = (
                first_trade.price_at_trade if first_trade
                else asset["initial_allocation"] / 100.0
            )

        initial_units = asset["initial_allocation"] / avg_entry_price if avg_entry_price > 0 else 0.0

        confirmed_trades = (
            db.query(Trade)
            .filter(Trade.asset_name == name, Trade.confirmed == True)  # noqa: E712
            .all()
        )
        total_units_change = sum(t.units_change or 0.0 for t in confirmed_trades)
        units_held = round(initial_units + total_units_change, 4)

        # current_price: yfinance for real assets, random walk for mock assets
        # BACKFILL: replace mock asset pricing with real tickers when available
        if name in REAL_ASSET_TICKERS:
            try:
                current_price = round(float(yf.Ticker(REAL_ASSET_TICKERS[name]).fast_info["last_price"]), 2)
            except Exception:
                current_price = prev_pos.get(name, {}).get("current_price", round(avg_entry_price, 2))
        else:
            last_price = prev_pos.get(name, {}).get("current_price", avg_entry_price)
            current_price = round(last_price * random.uniform(0.98, 1.02), 2)

        positions.append({
            "asset_name":      name,
            "units_held":      units_held,
            "avg_entry_price": round(avg_entry_price, 2),
            "current_price":   current_price,
            "current_value":   round(units_held * current_price, 2),
        })

    return positions


def _compute_strategy_eval(db: Session, eval_date: date) -> StrategyEvaluation:
    """Compute all StrategyEvaluation fields from current DB state and return (unsaved) row."""
    # win_rate: all confirmed trades with non-null ndr
    confirmed = (
        db.query(Trade)
        .filter(Trade.confirmed == True, Trade.next_trading_day_return != None)  # noqa: E712, E711
        .all()
    )
    if confirmed:
        correct = sum(
            1 for t in confirmed
            if (t.signal == "BUY" and t.next_trading_day_return > 0)
            or (t.signal in ("SELL", "SHORT") and t.next_trading_day_return < 0)
            or (t.signal == "HOLD")
        )
        win_rate = round(correct / len(confirmed) * 100, 1)
    else:
        win_rate = None

    # Portfolio metrics up to eval_date
    ph_rows = (
        db.query(PortfolioHistory)
        .filter(PortfolioHistory.record_date <= eval_date)
        .order_by(PortfolioHistory.record_date)
        .all()
    )
    daily_returns = [r.daily_return for r in ph_rows if r.daily_return is not None]

    avg_return   = round(sum(daily_returns) / len(daily_returns), 4) if daily_returns else None
    volatility   = round(_stats.stdev(daily_returns), 4) if len(daily_returns) >= 2 else None
    sharpe_ratio = None
    if avg_return is not None and volatility is not None and volatility > 0:
        sharpe_ratio = round(avg_return / volatility * math.sqrt(24), 4)

    # rolling_30d_return
    window_start = eval_date - timedelta(days=30)
    ph_window    = [r for r in ph_rows if r.record_date >= window_start]
    if len(ph_window) >= 2:
        rolling_30d_return = round(
            (ph_window[-1].total_value - ph_window[0].total_value) / ph_window[0].total_value * 100, 2
        )
    elif len(ph_window) == 1:
        rolling_30d_return = 0.0
    else:
        rolling_30d_return = None

    return StrategyEvaluation(
        eval_date=eval_date,
        sharpe_ratio=sharpe_ratio,
        win_rate=win_rate,
        avg_return=avg_return,
        volatility=volatility,
        rolling_30d_return=rolling_30d_return,
    )


# ---------------------------------------------------------------------------
# Strategy
# ---------------------------------------------------------------------------

@app.post("/api/strategy/run")
def run_strategy(db: Session = Depends(get_db)):
    today = date.today()

    # If strategy was already run today, return the existing signals
    existing = db.query(Trade).filter(Trade.trade_date == today).all()
    if existing:
        snaps = db.query(FredSnapshot).filter(FredSnapshot.snapshot_date == today).all()
        snap_map = {s.asset_name: s.value for s in snaps}
        weight_map = {a["name"]: a["optuna_weight"] for a in ASSETS}
        asset_order = [a["name"] for a in ASSETS]
        existing_by_asset = {t.asset_name: t for t in existing}
        return {
            "run_date": today.isoformat(),
            "signals": [
                {
                    "asset_name": name,
                    "signal":     existing_by_asset[name].signal,
                    "fred_value": snap_map.get(name, 0.0),
                    "weight":     weight_map.get(name, 0.0),
                    "trade_id":   existing_by_asset[name].id,
                }
                for name in asset_order
                if name in existing_by_asset
            ],
        }

    # Pull FRED values and save snapshots
    fred_values: dict[str, float] = {}
    for asset in ASSETS:
        value = get_fred_value(asset["fred_series"])
        fred_values[asset["name"]] = value
        db.add(FredSnapshot(
            snapshot_date=today,
            asset_name=asset["name"],
            series_id=asset["fred_series"],
            value=value,
        ))

    # Run master strategy
    signals = strategy.run(fred_values)

    # Save trade signals and capture IDs
    results = []
    for sig in signals:
        trade = Trade(
            trade_date=today,
            asset_name=sig["asset_name"],
            signal=sig["signal"],
            confirmed=False,
        )
        db.add(trade)
        db.flush()  # populate trade.id before commit
        results.append({**sig, "trade_id": trade.id})

    db.commit()

    # Compute and save a StrategyEvaluation row for today
    eval_row = _compute_strategy_eval(db, today)
    db.add(eval_row)
    db.commit()

    return {"run_date": today.isoformat(), "signals": results}


@app.get("/api/strategy/latest")
def get_latest_strategy(db: Session = Depends(get_db)):
    latest_trade = db.query(Trade).order_by(Trade.trade_date.desc()).first()
    if not latest_trade:
        return {"run_date": None, "signals": []}

    latest_date = latest_trade.trade_date
    trades = db.query(Trade).filter(Trade.trade_date == latest_date).all()
    snaps  = db.query(FredSnapshot).filter(FredSnapshot.snapshot_date == latest_date).all()
    snap_map   = {s.asset_name: s.value for s in snaps}
    weight_map = {a["name"]: a["optuna_weight"] for a in ASSETS}
    asset_order = [a["name"] for a in ASSETS]

    # Deduplicate: one signal per asset, in model_store.json order
    by_asset = {}
    for t in trades:
        if t.asset_name not in by_asset:
            by_asset[t.asset_name] = t

    return {
        "run_date": latest_date.isoformat(),
        "signals": [
            {
                "asset_name": name,
                "signal":     by_asset[name].signal,
                "fred_value": snap_map.get(name, 0.0),
                "weight":     weight_map.get(name, 0.0),
                "trade_id":   by_asset[name].id,
            }
            for name in asset_order
            if name in by_asset
        ],
    }


# ---------------------------------------------------------------------------
# Strategy evaluations
# ---------------------------------------------------------------------------

@app.get("/api/strategy/evaluations")
def get_strategy_evaluations(db: Session = Depends(get_db)):
    rows = (
        db.query(StrategyEvaluation)
        .order_by(StrategyEvaluation.eval_date)
        .all()
    )
    return [
        {
            "eval_date":          r.eval_date.isoformat(),
            "sharpe_ratio":       r.sharpe_ratio,
            "win_rate":           r.win_rate,
            "avg_return":         r.avg_return,
            "volatility":         r.volatility,
            "rolling_30d_return": r.rolling_30d_return,
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Trades
# ---------------------------------------------------------------------------

@app.get("/api/trades")
def get_trades(
    asset:     Optional[str]  = Query(None),
    from_date: Optional[date] = Query(None, alias="from"),
    to_date:   Optional[date] = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    q = db.query(Trade)
    if asset:     q = q.filter(Trade.asset_name == asset)
    if from_date: q = q.filter(Trade.trade_date >= from_date)
    if to_date:   q = q.filter(Trade.trade_date <= to_date)

    return [
        {
            "id":                       t.id,
            "trade_date":               t.trade_date.isoformat(),
            "asset_name":               t.asset_name,
            "signal":                   t.signal,
            "confirmed":                t.confirmed,
            "action_taken":             t.action_taken,
            "units_change":             t.units_change,
            "position_size":            t.position_size,
            "price_at_trade":           t.price_at_trade,
            "next_trading_day_return":  t.next_trading_day_return,
            "signal_confidence":        t.signal_confidence,
        }
        for t in q.order_by(Trade.trade_date.desc()).all()
    ]


@app.get("/api/trades/confidence-heatmap")
def get_confidence_heatmap(db: Session = Depends(get_db)):
    """Returns signal confidence data for all trades, structured for heatmap display."""
    trades = db.query(Trade).order_by(Trade.trade_date).all()
    asset_order = [a["name"] for a in ASSETS]

    # Group by date, then output in asset order
    from collections import defaultdict
    by_date: dict[date, dict] = defaultdict(dict)
    for t in trades:
        by_date[t.trade_date][t.asset_name] = t

    result = []
    for trade_date in sorted(by_date.keys()):
        for asset_name in asset_order:
            t = by_date[trade_date].get(asset_name)
            if t:
                result.append({
                    "trade_date":       trade_date.isoformat(),
                    "asset_name":       asset_name,
                    "signal":           t.signal,
                    "signal_confidence": t.signal_confidence,
                    "confirmed":        t.confirmed,
                })
    return result


@app.post("/api/trades/confirm")
def confirm_trades(
    payload: list[dict[str, Any]] = Body(...),
    db: Session = Depends(get_db),
):
    """
    Payload: [{trade_id, action_taken, position_size, price_at_trade}, ...]
    """
    confirmed_ids = []
    for item in payload:
        trade = db.query(Trade).filter(Trade.id == item["trade_id"]).first()
        if not trade:
            continue
        trade.confirmed      = True
        trade.action_taken   = item.get("action_taken", trade.signal)
        trade.position_size  = item.get("position_size")
        trade.price_at_trade = item.get("price_at_trade")
        if trade.action_taken in ("BUY", "SELL"):
            size  = trade.position_size or 0.0
            price = trade.price_at_trade or 0.0
            if price > 0:
                raw = round(size / price, 4)
                trade.units_change = raw if trade.action_taken == "BUY" else -raw
        # BACKFILL: replace with real cvxpy confidence output
        trade.signal_confidence = _mock_confidence(trade.action_taken or trade.signal)
        confirmed_ids.append(trade.id)
    db.commit()

    # --- Write portfolio_history and benchmark_history rows ---
    today = date.today()

    positions   = _build_positions(db)
    total_value = sum(p["current_value"] for p in positions)
    pct_return  = round((total_value - INITIAL_VALUE) / INITIAL_VALUE * 100, 2)

    prev        = db.query(PortfolioHistory).order_by(PortfolioHistory.record_date.desc()).first()
    daily_return = round((total_value - prev.total_value) / prev.total_value * 100, 2) if prev else None
    peak_value   = max(prev.peak_value if prev else 0, total_value)
    drawdown     = round(-(peak_value - total_value) / peak_value * 100, 2) if peak_value > 0 else 0.0

    existing_ph = db.query(PortfolioHistory).filter(PortfolioHistory.record_date == today).first()
    if not existing_ph:
        db.add(PortfolioHistory(
            record_date=today,
            total_value=round(total_value, 2),
            pct_return=pct_return,
            daily_return=daily_return,
            peak_value=round(peak_value, 2),
            drawdown=drawdown,
            positions_json=json.dumps(positions),
        ))

    existing_bh = db.query(BenchmarkHistory).filter(BenchmarkHistory.record_date == today).first()
    if not existing_bh:
        try:
            import yfinance as yf
            spy_price = float(yf.Ticker("SPY").fast_info["last_price"])
            base_bh   = db.query(BenchmarkHistory).order_by(BenchmarkHistory.record_date).first()
            base_price = spy_price / (base_bh.spy_value / 100000) if base_bh else spy_price
            spy_value      = round(100000 * spy_price / base_price, 2)
            spy_pct_return = round((spy_value - 100000) / 100000 * 100, 2)
        except Exception:
            prev_bh        = db.query(BenchmarkHistory).order_by(BenchmarkHistory.record_date.desc()).first()
            spy_value      = prev_bh.spy_value if prev_bh else 100000.0
            spy_pct_return = prev_bh.spy_pct_return if prev_bh else 0.0
        db.add(BenchmarkHistory(
            record_date=today,
            spy_value=spy_value,
            spy_pct_return=spy_pct_return,
        ))

    db.commit()
    return {"confirmed": confirmed_ids}


# ---------------------------------------------------------------------------
# Portfolio
# ---------------------------------------------------------------------------

@app.get("/api/portfolio/history")
def get_portfolio_history(db: Session = Depends(get_db)):
    records = db.query(PortfolioHistory).order_by(PortfolioHistory.record_date).all()
    return [
        {
            "record_date":    r.record_date.isoformat(),
            "total_value":    r.total_value,
            "pct_return":     r.pct_return,
            "daily_return":   r.daily_return,
            "peak_value":     r.peak_value,
            "drawdown":       r.drawdown,
            "positions_json": r.positions_json,
        }
        for r in records
    ]


@app.get("/api/portfolio/benchmark")
def get_benchmark(db: Session = Depends(get_db)):
    records = db.query(BenchmarkHistory).order_by(BenchmarkHistory.record_date).all()
    return [
        {
            "record_date":    r.record_date.isoformat(),
            "spy_value":      r.spy_value,
            "spy_pct_return": r.spy_pct_return,
        }
        for r in records
    ]


@app.get("/api/portfolio/drawdown")
def get_drawdown(db: Session = Depends(get_db)):
    records = db.query(PortfolioHistory).order_by(PortfolioHistory.record_date).all()
    return [
        {
            "record_date": r.record_date.isoformat(),
            "total_value": r.total_value,
            "peak_value":  r.peak_value,
            "drawdown":    r.drawdown,
        }
        for r in records
    ]


@app.get("/api/trades/signal-accuracy")
def get_signal_accuracy(db: Session = Depends(get_db)):
    trades = db.query(Trade).filter(Trade.confirmed == True).all()  # noqa: E712

    asset_stats: dict[str, dict] = {}
    for t in trades:
        if t.asset_name not in asset_stats:
            asset_stats[t.asset_name] = {"total": 0, "correct": 0}
        if t.next_trading_day_return is None:
            continue
        asset_stats[t.asset_name]["total"] += 1
        is_correct = (
            (t.signal == "BUY"   and t.next_trading_day_return > 0) or
            (t.signal in ("SELL", "SHORT") and t.next_trading_day_return < 0) or
            (t.signal == "HOLD")
        )
        if is_correct:
            asset_stats[t.asset_name]["correct"] += 1

    result = []
    for asset in ASSETS:
        name  = asset["name"]
        stats = asset_stats.get(name, {"total": 0, "correct": 0})
        total = stats["total"]
        accuracy = round(stats["correct"] / total * 100, 1) if total > 0 else None
        result.append({
            "asset_name":      name,
            "total_signals":   total,
            "correct_signals": stats["correct"],
            "accuracy_pct":    accuracy,
        })
    return result


@app.get("/api/portfolio/current")
def get_portfolio_current(db: Session = Depends(get_db)):
    latest = (
        db.query(PortfolioHistory)
        .order_by(PortfolioHistory.record_date.desc())
        .first()
    )
    if not latest:
        return {"total_value": INITIAL_VALUE, "pct_return": 0.0, "positions": []}

    positions = json.loads(latest.positions_json) if latest.positions_json else []
    return {
        "total_value": latest.total_value,
        "pct_return":  latest.pct_return,
        "positions":   positions,
    }


# ---------------------------------------------------------------------------
# Assets
# ---------------------------------------------------------------------------

@app.get("/api/assets")
def get_assets(db: Session = Depends(get_db)):
    latest = (
        db.query(PortfolioHistory)
        .order_by(PortfolioHistory.record_date.desc())
        .first()
    )
    positions = json.loads(latest.positions_json) if latest and latest.positions_json else []
    pos_map   = {p["asset_name"]: p for p in positions}
    total_val = sum(p.get("current_value", 0) for p in positions) or INITIAL_VALUE

    result = []
    for asset in ASSETS:
        name = asset["name"]
        pos  = pos_map.get(name, {})
        last = (
            db.query(Trade)
            .filter(Trade.asset_name == name)
            .order_by(Trade.trade_date.desc())
            .first()
        )
        current_value = pos.get("current_value", asset["initial_allocation"])
        avg_entry     = pos.get("avg_entry_price", 0.0)
        current_price = pos.get("current_price", 0.0)
        pct_return    = (
            round((current_price - avg_entry) / avg_entry * 100, 2)
            if avg_entry > 0 else 0.0
        )
        result.append({
            "name":            name,
            "current_value":   round(current_value, 2),
            "allocation_pct":  round(current_value / total_val * 100, 1) if total_val else 0.0,
            "pct_return":      pct_return,
            "last_signal":     last.signal if last else None,
            "last_trade_date": last.trade_date.isoformat() if last else None,
        })
    return result
