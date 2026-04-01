from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Date
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./trading.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Trade(Base):
    __tablename__ = "trades"
    id                      = Column(Integer, primary_key=True, index=True)
    trade_date              = Column(Date, nullable=False, index=True)
    asset_name              = Column(String, nullable=False, index=True)
    signal                  = Column(String, nullable=False)   # BUY / SELL / HOLD / SHORT
    confirmed               = Column(Boolean, default=False)
    action_taken            = Column(String, nullable=True)
    units_change            = Column(Float, nullable=True)     # positive = bought, negative = sold
    position_size           = Column(Float, nullable=True)
    price_at_trade          = Column(Float, nullable=True)
    next_trading_day_return = Column(Float, nullable=True)     # backfilled after next trading day


class FredSnapshot(Base):
    __tablename__ = "fred_snapshots"
    id            = Column(Integer, primary_key=True, index=True)
    snapshot_date = Column(Date, nullable=False, index=True)
    asset_name    = Column(String, nullable=False, index=True)
    series_id     = Column(String, nullable=False)
    value         = Column(Float, nullable=True)


class PortfolioHistory(Base):
    __tablename__ = "portfolio_history"
    id             = Column(Integer, primary_key=True, index=True)
    record_date    = Column(Date, nullable=False, index=True)
    total_value    = Column(Float, nullable=False)
    pct_return     = Column(Float, nullable=False)
    daily_return   = Column(Float, nullable=True)   # % return from prior trading day
    peak_value     = Column(Float, nullable=True)   # highest total_value up to this date
    drawdown       = Column(Float, nullable=True)   # (peak - total) / peak * 100, stored negative
    positions_json = Column(String, nullable=True)


class BenchmarkHistory(Base):
    __tablename__ = "benchmark_history"
    id             = Column(Integer, primary_key=True, index=True)
    record_date    = Column(Date, nullable=False, index=True)
    spy_value      = Column(Float, nullable=False)      # $100k invested in SPY on Jan 1
    spy_pct_return = Column(Float, nullable=False)      # % return from $100k starting value


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
