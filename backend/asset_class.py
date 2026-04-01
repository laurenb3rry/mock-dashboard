"""
asset_class.py — base AssetClass and all 7 subclasses.

Each subclass maps to one of the 7 assets in model_store.json.
BACKFILL: override generate_signal() in each subclass with the real
          Optuna-trained signal logic from the corresponding Colab file.
"""
import random


class AssetClass:
    """
    Base class for all 7 asset classes.
    BACKFILL: override generate_signal() in each subclass with real per-asset logic.
    """
    def __init__(self, name: str, fred_series: str, optuna_weight: float):
        self.name = name
        self.fred_series = fred_series
        self.optuna_weight = optuna_weight

    def generate_signal(self, fred_value: float) -> str:
        """
        Returns BUY / SELL / HOLD / SHORT.
        BACKFILL: replace with real Optuna-trained signal logic for this asset.
        """
        return random.choices(
            ["BUY", "SELL", "HOLD", "SHORT"],
            weights=[0.35, 0.20, 0.35, 0.10]
        )[0]


class Gold(AssetClass):
    """BACKFILL: implement real gold signal logic."""
    def __init__(self, weight: float):
        super().__init__("gold", "GOLDAMGBD228NLBM", weight)


class BTC(AssetClass):
    """BACKFILL: implement real BTC signal logic."""
    def __init__(self, weight: float):
        super().__init__("btc", "CBBTCUSD", weight)


class QQQ(AssetClass):
    """BACKFILL: implement real QQQ signal logic."""
    def __init__(self, weight: float):
        super().__init__("qqq", "NASDAQ100", weight)


class AssetClass4(AssetClass):
    """BACKFILL: rename, set real fred_series, implement real signal logic."""
    def __init__(self, weight: float):
        super().__init__("asset4", "MOCK_SERIES_4", weight)


class AssetClass5(AssetClass):
    """BACKFILL: rename, set real fred_series, implement real signal logic."""
    def __init__(self, weight: float):
        super().__init__("asset5", "MOCK_SERIES_5", weight)


class AssetClass6(AssetClass):
    """BACKFILL: rename, set real fred_series, implement real signal logic."""
    def __init__(self, weight: float):
        super().__init__("asset6", "MOCK_SERIES_6", weight)


class AssetClass7(AssetClass):
    """BACKFILL: rename, set real fred_series, implement real signal logic."""
    def __init__(self, weight: float):
        super().__init__("asset7", "MOCK_SERIES_7", weight)


CLASS_MAP = {
    "gold":   Gold,
    "btc":    BTC,
    "qqq":    QQQ,
    "asset4": AssetClass4,
    "asset5": AssetClass5,
    "asset6": AssetClass6,
    "asset7": AssetClass7,
}
