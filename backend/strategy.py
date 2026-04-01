"""
strategy.py — MasterStrategy. No FastAPI or SQLAlchemy imports.

BACKFILL: replace run() with the real cvxpy portfolio optimization.
"""
import json
from pathlib import Path

from asset_class import CLASS_MAP

BASE_DIR = Path(__file__).parent

with open(BASE_DIR / "model_store.json") as f:
    _store = json.load(f)

ASSET_CONFIG = _store["assets"]


class MasterStrategy:
    """
    Loads all 7 asset classes from model_store.json and combines their signals.
    BACKFILL: replace run() with real cvxpy portfolio optimization.
    """
    def __init__(self):
        self.assets = [
            CLASS_MAP[a["name"]](a["optuna_weight"])
            for a in ASSET_CONFIG
        ]

    def run(self, fred_values: dict) -> list:
        """
        Takes {asset_name: fred_value} and returns list of signal dicts.
        BACKFILL: replace mock per-asset signals with real cvxpy-derived output.
        """
        results = []
        for asset in self.assets:
            fred_val = fred_values.get(asset.name, 0.0)
            signal = asset.generate_signal(fred_val)
            results.append({
                "asset_name": asset.name,
                "signal":     signal,
                "fred_value": fred_val,
                "weight":     asset.optuna_weight,
            })
        return results
