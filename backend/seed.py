"""
seed.py — populate the database with mock 2026 data.

Run: python seed.py
Drops and recreates trading.db every time.
"""
import json
import math
import os
import random
import statistics as stats_lib
import sys
from datetime import date, timedelta
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, str(Path(__file__).parent))
from database import (
    SessionLocal, create_tables,
    Trade, FredSnapshot, PortfolioHistory, BenchmarkHistory, StrategyEvaluation,
)

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

# One portfolio snapshot per trading day
PORTFOLIO_HISTORY = [
    (date(2026, 1,  1),  100000.0),
    (date(2026, 1, 15),  103200.0),
    (date(2026, 2,  1),  104600.0),  # dip — below Jan 15
    (date(2026, 2, 15),  108900.0),
    (date(2026, 3,  1),  111500.0),
    (date(2026, 3, 15),  120800.0),
    (date(2026, 4,  1),  119700.0),  # slight dip from Mar 15 peak
]

# Fallback SPY prices if yfinance is unavailable (approximate 2026 values)
SPY_FALLBACK = {
    date(2026, 1,  1): 592.00,
    date(2026, 1, 15): 598.80,
    date(2026, 2,  1): 601.30,
    date(2026, 2, 15): 609.10,
    date(2026, 3,  1): 613.40,
    date(2026, 3, 15): 621.30,
    date(2026, 4,  1): 623.90,
}

INITIAL_UNITS = {pos["asset_name"]: pos["units_held"] for pos in INITIAL_POSITIONS}

REAL_SERIES = {"GOLDAMGBD228NLBM", "CBBTCUSD", "NASDAQ100"}

# For gold, try these series IDs in order before falling back to random
GOLD_SERIES_ATTEMPTS = ["XAUUSD", "GOLDPMGBD228NLBM"]


def fetch_fred_values(series_id: str, dates: list[date]) -> dict[date, float]:
    """Fetch real FRED values for a series across the given dates.
    Returns {date: float}. Falls back to random from FRED_RANGES on any failure.
    For gold (GOLDAMGBD228NLBM), tries XAUUSD then GOLDPMGBD228NLBM before giving up.
    """
    import certifi
    os.environ["SSL_CERT_FILE"] = certifi.where()
    from fredapi import Fred
    fred = Fred(api_key=os.getenv("FRED_API_KEY"))

    lo, hi = FRED_RANGES[series_id]

    # Build the list of series IDs to attempt
    if series_id == "GOLDAMGBD228NLBM":
        attempts = GOLD_SERIES_ATTEMPTS
    else:
        attempts = [series_id]

    raw_series = None
    used_id = None
    for attempt_id in attempts:
        try:
            raw_series = fred.get_series(attempt_id)
            used_id = attempt_id
            print(f"  FRED: fetched {len(raw_series)} observations for {attempt_id}")
            break
        except Exception as e:
            print(f"  FRED: {attempt_id} not available ({e}), trying next...")

    if raw_series is None:
        print(f"  FRED: all attempts failed for {series_id}, using random fallback for all dates")
        return {d: round(random.uniform(lo, hi), 2) for d in dates}

    result: dict[date, float] = {}
    date_strings = raw_series.index.strftime("%Y-%m-%d")
    for d in dates:
        for offset in range(31):
            lookup = (d - timedelta(days=offset)).strftime("%Y-%m-%d")
            if lookup in date_strings:
                val = raw_series[date_strings == lookup].iloc[-1]
                if val is not None and not (isinstance(val, float) and val != val):  # skip NaN
                    result[d] = round(float(val), 2)
                    break
        if d not in result:
            result[d] = round(random.uniform(lo, hi), 2)
            print(f"  FRED: no value found for {used_id} on {d}, using random fallback")
    return result


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


def _signal_confidence(signal: str) -> float:
    """Generate a mock signal confidence value. BACKFILL: replace with real cvxpy output."""
    if signal in ("BUY", "SHORT"):
        base = random.uniform(0.65, 0.95)
    elif signal == "HOLD":
        base = random.uniform(0.45, 0.65)
    else:  # SELL
        base = random.uniform(0.45, 0.95)
    # Small variation to ensure uniqueness
    return round(min(0.99, max(0.01, base + random.uniform(-0.015, 0.015))), 3)


def seed():
    db = SessionLocal()

    # Fetch real FRED values for known series, one batch per series
    print("Fetching real FRED data...")
    fred_cache: dict[str, dict[date, float]] = {}
    for series_id in REAL_SERIES:
        fred_cache[series_id] = fetch_fred_values(series_id, TRADING_DAYS)

    trade_changes: list[dict] = []
    asset4_trade_count = 0  # track confirmed past trades for asset4

    # In-memory trade records for computing strategy evaluations
    # (trade_date, asset_name, signal, ndr, confirmed)
    seeded_trade_data: list[tuple] = []

    # ── Trades & FRED snapshots ────────────────────────────────────────────────
    for trade_date in TRADING_DAYS:
        for asset_name, series_id in ASSET_SERIES.items():
            if series_id in fred_cache and trade_date in fred_cache[series_id]:
                fred_value = fred_cache[series_id][trade_date]
            else:
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

            confidence = _signal_confidence(signal) if is_past else None

            seeded_trade_data.append((trade_date, signal, ndr, is_past))

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
                signal_confidence=confidence,
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

    # ── Strategy evaluations ───────────────────────────────────────────────────
    for trade_date in TRADING_DAYS:
        # win_rate: correct signals that trading day (confirmed, with ndr)
        day_trades = [
            (sig, ndr)
            for (td, sig, ndr, conf) in seeded_trade_data
            if td == trade_date and conf and ndr is not None
        ]
        if day_trades:
            correct = sum(
                1 for sig, ndr in day_trades
                if (sig == "BUY" and ndr > 0)
                or (sig in ("SELL", "SHORT") and ndr < 0)
                or (sig == "HOLD")
            )
            win_rate = round(correct / len(day_trades) * 100, 1)
        else:
            win_rate = None

        # Portfolio metrics: daily_returns up to this date (computed from PORTFOLIO_HISTORY)
        ph_up_to = [(d, v) for d, v in PORTFOLIO_HISTORY if d <= trade_date]
        daily_returns = [
            (ph_up_to[i][1] - ph_up_to[i - 1][1]) / ph_up_to[i - 1][1] * 100
            for i in range(1, len(ph_up_to))
        ]

        avg_return  = round(sum(daily_returns) / len(daily_returns), 4) if daily_returns else None
        volatility  = round(stats_lib.stdev(daily_returns), 4) if len(daily_returns) >= 2 else None
        sharpe_ratio = None
        if avg_return is not None and volatility is not None and volatility > 0:
            sharpe_ratio = round(avg_return / volatility * math.sqrt(24), 4)

        # rolling_30d_return: portfolio % return over 30 days preceding this date
        window_start = trade_date - timedelta(days=30)
        ph_window = [(d, v) for d, v in PORTFOLIO_HISTORY if window_start <= d <= trade_date]
        if len(ph_window) >= 2:
            rolling_30d_return = round(
                (ph_window[-1][1] - ph_window[0][1]) / ph_window[0][1] * 100, 2
            )
        elif len(ph_window) == 1:
            rolling_30d_return = 0.0
        else:
            rolling_30d_return = None

        db.add(StrategyEvaluation(
            eval_date=trade_date,
            sharpe_ratio=sharpe_ratio,
            win_rate=win_rate,
            avg_return=avg_return,
            volatility=volatility,
            rolling_30d_return=rolling_30d_return,
        ))

    db.commit()
    db.close()
    print(
        f"Seeded {len(TRADING_DAYS) * len(ASSET_SERIES)} trades, "
        f"{len(TRADING_DAYS) * len(ASSET_SERIES)} FRED snapshots, "
        f"{len(PORTFOLIO_HISTORY)} portfolio snapshots, "
        f"{len(history_dates)} benchmark rows, "
        f"{len(TRADING_DAYS)} strategy evaluation rows."
    )


if __name__ == "__main__":
    seed()
