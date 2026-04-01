"""
fred_client.py — thin wrapper around the FRED API.

BACKFILL: uncomment the real fredapi calls once FRED_API_KEY is set in .env.
          Mock series (asset4–7) will always return random floats since
          their series IDs are placeholders.
"""
import os
import random
from dotenv import load_dotenv

load_dotenv()

FRED_API_KEY = os.getenv("FRED_API_KEY", "")

# Realistic ranges for the three known real series
_MOCK_RANGES = {
    "GOLDAMGBD228NLBM": (2600.0, 2800.0),   # Gold price, USD/troy oz
    "CBBTCUSD":         (95000.0, 105000.0), # BTC price, USD
    "NASDAQ100":        (19000.0, 22000.0),  # NASDAQ 100 index level
}


def get_fred_value(series_id: str) -> float:
    """
    Returns the latest value for a FRED series.

    For mock series (MOCK_SERIES_*): always returns a random float.
    For real series: returns a mocked value for now.
    BACKFILL: uncomment the real fredapi block below once FRED_API_KEY is set.
    """
    if series_id.startswith("MOCK_"):
        # BACKFILL: these series IDs don't exist — replace with real ones in model_store.json
        return round(random.uniform(80.0, 120.0), 2)

    # BACKFILL: uncomment when real FRED_API_KEY is available
    # if FRED_API_KEY:
    #     from fredapi import Fred
    #     fred = Fred(api_key=FRED_API_KEY)
    #     series = fred.get_series(series_id)
    #     return float(series.dropna().iloc[-1])

    lo, hi = _MOCK_RANGES.get(series_id, (80.0, 120.0))
    return round(random.uniform(lo, hi), 2)
