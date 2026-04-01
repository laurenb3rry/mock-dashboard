"""
seed.py — populate the database with mock 2026 data.

Run: python seed.py
Drops and recreates trading.db every time.
"""
import json
import os
import random
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from database import SessionLocal, create_tables, Trade, FredSnapshot, PortfolioHistory, BenchmarkHistory

random.seed(42)

# ── Drop existing DB so schema changes take effect ─────────────────────────────
DB_PATH = Path(__file__).parent / "trading.db"
if DB_PATH.exists():
    os.remove(DB_PATH)
    print("Dropped existing database.")

create_tables()

# ── Static data ────────────────────────────────────────────────────────────────

INITIAL_POSITIONS = [
    {"asset_name": "gold",   "units_held": 68.5,  "avg_entry_price": 208.54,   "current_price": 208.54},
    {"asset_name": "btc",    "units_held": 0.142, "avg_entry_price": 100600.0, "current_price": 100600.0},
    {"asset_name": "qqq",    "units_held": 28.3,  "avg_entry_price": 505.0,    "current_price": 505.0},
    {"asset_name": "asset4", "units_held": 142.9, "avg_entry_price": 100.0,    "current_price": 100.0},
    {"asset_name": "asset5", "units_held": 95.2,  "avg_entry_price": 150.0,    "current_price": 150.0},
    {"asset_name": "asset6", "units_held": 238.1, "avg_entry_price": 60.0,     "current_price": 60.0},
    {"asset_name": "asset7", "units_held": 178.6, "avg_entry_price": 80.0,     "current_price": 80.0},
]

TRADING_DAYS = [
    date(2026, 1,  1),
    date(2026, 1, 15),
    date(2026, 2,  1),
    date(2026, 2, 15),
    date(2026, 3,  1),
    date(2026, 3, 15),
    date(2026, 4,  1),
]

ASSET_SERIES = {
    "gold":   "GOLDAMGBD228NLBM",
    "btc":    "CBBTCUSD",
    "qqq":    "NASDAQ100",
    "asset4": "MOCK_SERIES_4",
    "asset5": "MOCK_SERIES_5",
    "asset6": "MOCK_SERIES_6",
    "asset7": "MOCK_SERIES_7",
}

FRED_RANGES = {
    "GOLDAMGBD228NLBM": (2600.0, 2800.0),
    "CBBTCUSD":         (95000.0, 105000.0),
    "NASDAQ100":        (19000.0, 22000.0),
    "MOCK_SERIES_4":    (80.0, 120.0),
    "MOCK_SERIES_5":    (80.0, 120.0),
    "MOCK_SERIES_6":    (80.0, 120.0),
    "MOCK_SERIES_7":    (80.0, 120.0),
}

# Weekly portfolio history with 2 genuine dips (3-8% from peaks)
PORTFOLIO_HISTORY = [
    (date(2026, 1,  1),  100000.0),
    (date(2026, 1,  8),  102400.0),
    (date(2026, 1, 15),  105300.0),
    (date(2026, 1, 22),  108100.0),
    (date(2026, 1, 29),  111500.0),  # peak 1
    (date(2026, 2,  5),  108200.0),  # dip 1: −3.0% from peak
    (date(2026, 2, 12),  104600.0),  # dip 1: −6.2% from peak
    (date(2026, 2, 19),  107800.0),  # recovery
    (date(2026, 2, 26),  111900.0),  # new peak
    (date(2026, 3,  5),  116200.0),
    (date(2026, 3, 12),  120800.0),  # peak 2
    (date(2026, 3, 19),  116100.0),  # dip 2: −3.9% from peak 2
    (date(2026, 3, 26),  113400.0),  # dip 2: −6.1% from peak 2
    (date(2026, 4,  1),  119700.0),  # recovery (today)
]

# Fallback SPY prices if yfinance is unavailable (approximate 2026 values)
SPY_FALLBACK = {
    date(2026, 1,  1): 592.00,
    date(2026, 1,  8): 595.30,
    date(2026, 1, 15): 598.80,
    date(2026, 1, 22): 602.40,
    date(2026, 1, 29): 599.60,
    date(2026, 2,  5): 596.20,
    date(2026, 2, 12): 603.50,
    date(2026, 2, 19): 609.10,
    date(2026, 2, 26): 613.40,
    date(2026, 3,  5): 617.80,
    date(2026, 3, 12): 621.30,
    date(2026, 3, 19): 616.50,
    date(2026, 3, 26): 619.20,
    date(2026, 4,  1): 623.90,
}

INITIAL_UNITS = {pos["asset_name"]: pos["units_held"] for pos in INITIAL_POSITIONS}


def fetch_spy_prices(dates: list[date]) -> dict[date, float] | None:
    """Fetch real SPY closing prices via yfinance, returns None on failure."""
    try:
        import yfinance as yf
        start = min(dates).strftime("%Y-%m-%d")
        end   = (max(dates) + timedelta(days=5)).strftime("%Y-%m-%d")
        df = yf.download("SPY", start=start, end=end, progress=False, auto_adjust=True)
        if df.empty:
            return None
        close = df["Close"].squeeze()
        result: dict[date, float] = {}
        close_dates = [idx.date() for idx in close.index]
        for d in dates:
            candidates = [cd for cd in close_dates if cd <= d]
            if not candidates:
                candidates = close_dates
            nearest = max(candidates)
            result[d] = float(close.iloc[close_dates.index(nearest)])
        print(f"  yfinance: fetched {len(result)} SPY prices.")
        return result
    except Exception as e:
        print(f"  yfinance failed ({e}), using mock SPY values.")
        return None


def seed():
    db = SessionLocal()

    trade_changes: list[dict] = []
    asset4_trade_count = 0  # track confirmed past trades for asset4

    # ── Trades & FRED snapshots ────────────────────────────────────────────────
    for trade_date in TRADING_DAYS:
        for asset_name, series_id in ASSET_SERIES.items():
            lo, hi = FRED_RANGES[series_id]
            fred_value = round(random.uniform(lo, hi), 2)

            db.add(FredSnapshot(
                snapshot_date=trade_date,
                asset_name=asset_name,
                series_id=series_id,
                value=fred_value,
            ))

            signal   = random.choices(["BUY", "SELL", "HOLD", "SHORT"], weights=[0.35, 0.20, 0.35, 0.10])[0]
            is_past  = trade_date < date.today()
            size     = round(random.uniform(2000, 8000), 2) if signal != "HOLD" else 0.0
            price    = round(fred_value * random.uniform(0.99, 1.01), 2) if is_past else None

            if is_past and signal in ("BUY", "SELL") and price and price > 0:
                raw          = round(size / price, 4)
                units_change = raw if signal == "BUY" else -raw
            else:
                units_change = 0.0

            trade_changes.append({"trade_date": trade_date, "asset_name": asset_name, "units_change": units_change})

            # Next-day return biased by signal; asset4 is intentionally inverted (poor accuracy)
            if is_past:
                if asset_name == "asset4":
                    asset4_trade_count += 1
                    # Make exactly the 3rd trade correct (1/6), rest wrong
                    if asset4_trade_count == 3:
                        ndr = round(random.uniform(0.1, 3.0), 2) if signal in ("BUY", "HOLD") else round(random.uniform(-3.0, -0.1), 2)
                    elif signal == "BUY" or signal == "HOLD":
                        ndr = round(random.uniform(-4.5, -0.1), 2)
                    else:
                        ndr = round(random.uniform(0.1, 4.5), 2)
                else:
                    if signal == "BUY":
                        ndr = round(random.uniform(-1.8, 3.8), 2)   # ~68% positive
                    elif signal in ("SELL", "SHORT"):
                        ndr = round(random.uniform(-3.8, 1.8), 2)   # ~68% negative
                    else:
                        ndr = round(random.uniform(-2.0, 2.0), 2)
            else:
                ndr = None

            db.add(Trade(
                trade_date=trade_date,
                asset_name=asset_name,
                signal=signal,
                confirmed=is_past,
                action_taken=signal if is_past else None,
                units_change=units_change if is_past and signal in ("BUY", "SELL") else None,
                position_size=size if is_past else None,
                price_at_trade=price if is_past else None,
                next_trading_day_return=ndr,
            ))

    # ── Portfolio history ──────────────────────────────────────────────────────
    peak = 0.0
    prev_value = None

    for i, (record_date, total_value) in enumerate(PORTFOLIO_HISTORY):
        scale      = total_value / 100000.0
        pct_return = round((total_value - 100000.0) / 100000.0 * 100, 2)

        daily_return = None
        if prev_value is not None and prev_value > 0:
            daily_return = round((total_value - prev_value) / prev_value * 100, 2)
        prev_value = total_value

        peak = max(peak, total_value)
        drawdown = round(-(peak - total_value) / peak * 100, 2) if peak > 0 else 0.0

        positions = []
        for pos in INITIAL_POSITIONS:
            name = pos["asset_name"]
            cumulative_change = sum(
                t["units_change"]
                for t in trade_changes
                if t["asset_name"] == name and t["trade_date"] <= record_date
            )
            units_held    = round(INITIAL_UNITS[name] + cumulative_change, 4)
            current_price = round(pos["current_price"] * scale * random.uniform(0.97, 1.03), 2)
            positions.append({
                "asset_name":      name,
                "units_held":      units_held,
                "avg_entry_price": pos["avg_entry_price"],
                "current_price":   current_price,
                "current_value":   round(units_held * current_price, 2),
            })

        db.add(PortfolioHistory(
            record_date=record_date,
            total_value=total_value,
            pct_return=pct_return,
            daily_return=daily_return,
            peak_value=round(peak, 2),
            drawdown=drawdown,
            positions_json=json.dumps(positions),
        ))

    # ── Benchmark (SPY) ────────────────────────────────────────────────────────
    history_dates = [d for d, _ in PORTFOLIO_HISTORY]
    print("Fetching SPY benchmark data...")
    spy_prices = fetch_spy_prices(history_dates) or SPY_FALLBACK

    base_price = spy_prices.get(history_dates[0])
    if not base_price:
        base_price = next(iter(spy_prices.values()))

    for d in history_dates:
        price = spy_prices.get(d)
        if price is None:
            # Forward-fill: find nearest prior date
            prior = [k for k in spy_prices if k <= d]
            price = spy_prices[max(prior)] if prior else base_price

        spy_value      = round(100000.0 * price / base_price, 2)
        spy_pct_return = round((price / base_price - 1.0) * 100, 2)

        db.add(BenchmarkHistory(
            record_date=d,
            spy_value=spy_value,
            spy_pct_return=spy_pct_return,
        ))

    db.commit()
    db.close()
    print(
        f"Seeded {len(TRADING_DAYS) * len(ASSET_SERIES)} trades, "
        f"{len(TRADING_DAYS) * len(ASSET_SERIES)} FRED snapshots, "
        f"{len(PORTFOLIO_HISTORY)} portfolio snapshots, "
        f"{len(history_dates)} benchmark rows."
    )


if __name__ == "__main__":
    seed()
