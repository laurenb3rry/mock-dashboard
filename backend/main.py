import json
import random
from datetime import date
from typing import Any, Optional
from pathlib import Path

from fastapi import FastAPI, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import get_db, create_tables, Trade, FredSnapshot, PortfolioHistory, BenchmarkHistory
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
            "id":             t.id,
            "trade_date":     t.trade_date.isoformat(),
            "asset_name":     t.asset_name,
            "signal":         t.signal,
            "confirmed":      t.confirmed,
            "action_taken":   t.action_taken,
            "units_change":   t.units_change,
            "position_size":  t.position_size,
            "price_at_trade": t.price_at_trade,
        }
        for t in q.order_by(Trade.trade_date.desc()).all()
    ]


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
        confirmed_ids.append(trade.id)
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

    # Apply small random variation to simulate live prices
    # BACKFILL: replace with yfinance price lookup per asset ticker
    total = 0.0
    for pos in positions:
        pos["current_price"] = round(pos["current_price"] * random.uniform(0.99, 1.01), 2)
        pos["current_value"] = round(pos["units_held"] * pos["current_price"], 2)
        total += pos["current_value"]

    pct_return = round((total - INITIAL_VALUE) / INITIAL_VALUE * 100, 2)
    return {
        "total_value": round(total, 2),
        "pct_return":  pct_return,
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
