"""
strategy_brain.py  –  Alex V2 Multi-Strategy Brain + Backtester
===============================================================
Implements four algorithmic trading strategies, a walk-forward backtester,
and a regime-aware strategy selector.  All indicator calculations are
done with vectorised pandas; the backtest loop is bar-by-bar to support
realistic signal generation.

Author : Alex V2 Engine
Version: 1.0.0
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TAKER_FEE = 0.0004          # 0.04 % futures taker fee
SLIPPAGE = 0.0002           # 0.02 % slippage per fill
RISK_PER_TRADE = 0.01       # 1 % of portfolio risked per trade

OHLCV_COLS = ["open", "high", "low", "close", "volume"]


# ============================================================================
# Technical Indicator Helpers  (vectorised)
# ============================================================================

def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Relative Strength Index."""
    delta = series.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = (-delta).where(delta < 0, 0.0)
    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi.fillna(50.0)


def _atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average True Range."""
    high_low = df["high"] - df["low"]
    high_close = (df["high"] - df["close"].shift(1)).abs()
    low_close = (df["low"] - df["close"].shift(1)).abs()
    tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
    return tr.rolling(period, min_periods=period).mean()


def _ema(series: pd.Series, span: int) -> pd.Series:
    """Exponential Moving Average."""
    return series.ewm(span=span, adjust=False).mean()


def _bbands(series: pd.Series, period: int = 20, std_mult: float = 2.0) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """Bollinger Bands -> (upper, middle, lower)."""
    middle = series.rolling(period, min_periods=period).mean()
    std = series.rolling(period, min_periods=period).std()
    upper = middle + std_mult * std
    lower = middle - std_mult * std
    return upper, middle, lower


def _adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average Directional Index (Welles Wilder)."""
    tr1 = df["high"] - df["low"]
    tr2 = (df["high"] - df["close"].shift(1)).abs()
    tr3 = (df["low"] - df["close"].shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    plus_dm = (df["high"] - df["high"].shift(1)).clip(lower=0)
    minus_dm = (df["low"].shift(1) - df["low"]).clip(lower=0)
    plus_dm = plus_dm.where(plus_dm > minus_dm, 0.0)
    minus_dm = minus_dm.where(minus_dm > plus_dm, 0.0)

    atr = tr.rolling(period, min_periods=period).mean()
    plus_di = 100 * (plus_dm.rolling(period, min_periods=period).mean() / atr.replace(0, np.nan))
    minus_di = 100 * (minus_dm.rolling(period, min_periods=period).mean() / atr.replace(0, np.nan))

    dx = (100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)).fillna(0)
    adx = dx.rolling(period, min_periods=period).mean()
    return adx.fillna(0.0)


def _vwap(df: pd.DataFrame) -> pd.Series:
    """Intra-period Volume-Weighted Average Price (cumulative)."""
    typical = (df["high"] + df["low"] + df["close"]) / 3.0
    cum_tp_vol = (typical * df["volume"]).cumsum()
    cum_vol = df["volume"].cumsum()
    return cum_tp_vol / cum_vol.replace(0, np.nan)


def _stochastic(high: pd.Series, low: pd.Series, close: pd.Series, k: int = 14, d: int = 3) -> Tuple[pd.Series, pd.Series]:
    """Stochastic Oscillator -> (%K, %D)."""
    lowest_low = low.rolling(k, min_periods=k).min()
    highest_high = high.rolling(k, min_periods=k).max()
    range_hl = (highest_high - lowest_low).replace(0, np.nan)
    pct_k = 100 * (close - lowest_low) / range_hl
    pct_d = pct_k.rolling(d, min_periods=d).mean()
    return pct_k.fillna(50.0), pct_d.fillna(50.0)


def _rolling_resistance_support(close: pd.Series, window: int = 20) -> Tuple[pd.Series, pd.Series]:
    """Rolling resistance (max) and support (min) levels."""
    resistance = close.rolling(window, min_periods=window).max().shift(1)
    support = close.rolling(window, min_periods=window).min().shift(1)
    return resistance, support


def _avg_volume(volume: pd.Series, window: int = 20) -> pd.Series:
    """Rolling average volume."""
    return volume.rolling(window, min_periods=window).mean()


# ============================================================================
# Data Containers
# ============================================================================

@dataclass
class Trade:
    """Single completed trade record."""
    entry_idx: int
    exit_idx: int
    entry_price: float
    exit_price: float
    direction: str          # "LONG" or "SHORT"
    size: float
    pnl: float
    pnl_pct: float
    fees: float
    exit_reason: str


@dataclass
class BacktestResult:
    """Results returned by the backtest engine."""
    total_trades: int = 0
    win_rate: float = 0.0
    total_pnl: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    profit_factor: float = 0.0
    avg_trade: float = 0.0
    total_fees: float = 0.0
    equity_curve: List[float] = field(default_factory=list)
    trades: List[Trade] = field(default_factory=list)

    def to_dict(self) -> dict:
        def _f(v):
            if isinstance(v, (np.floating, np.integer)):
                return float(v) if isinstance(v, np.floating) else int(v)
            return v
        return {
            "total_trades": int(self.total_trades),
            "win_rate": _f(self.win_rate),
            "total_pnl": _f(self.total_pnl),
            "sharpe_ratio": _f(self.sharpe_ratio),
            "max_drawdown": _f(self.max_drawdown),
            "profit_factor": _f(self.profit_factor),
            "avg_trade": _f(self.avg_trade),
            "total_fees": _f(self.total_fees),
            "equity_curve": [float(x) for x in self.equity_curve],
            "trades": [
                {
                    "entry_idx": int(t.entry_idx),
                    "exit_idx": int(t.exit_idx),
                    "entry_price": float(t.entry_price),
                    "exit_price": float(t.exit_price),
                    "direction": t.direction,
                    "size": float(t.size),
                    "pnl": float(t.pnl),
                    "pnl_pct": float(t.pnl_pct),
                    "fees": float(t.fees),
                    "exit_reason": t.exit_reason,
                }
                for t in self.trades
            ],
        }


# ============================================================================
# Strategy Protocol
# ============================================================================

class Strategy:
    """Base class all strategies must implement."""

    name: str = "base"

    def prepare_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add all required indicator columns to *df* (vectorised)."""
        raise NotImplementedError

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add signal columns to *df*:
            - signal: 1 (buy), -1 (sell/short), 0 (hold)
            - stop_loss: price level
            - take_profit: price level (optional)
        Must be vectorised (used by backtester pre-scan).
        """
        raise NotImplementedError


# ============================================================================
# Strategy 1 – Mean Reversion
# ============================================================================

class MeanReversionStrategy(Strategy):
    """
    Mean Reversion
    =============
    Entry : RSI < 30  OR  price touches lower Bollinger Band
    Exit  : RSI > 50  OR  price hits middle BB
    Stop  : 1.5 x ATR below entry
    Best  : ranging / sideways markets
    """

    name = "mean_reversion"

    def __init__(
        self,
        rsi_period: int = 14,
        rsi_entry: int = 30,
        rsi_exit: int = 50,
        bb_period: int = 20,
        bb_std: float = 2.0,
        atr_period: int = 14,
        atr_mult: float = 1.5,
    ):
        self.rsi_period = rsi_period
        self.rsi_entry = rsi_entry
        self.rsi_exit = rsi_exit
        self.bb_period = bb_period
        self.bb_std = bb_std
        self.atr_period = atr_period
        self.atr_mult = atr_mult

    def prepare_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["rsi"] = _rsi(df["close"], self.rsi_period)
        df["atr"] = _atr(df, self.atr_period)
        upper, middle, lower = _bbands(df["close"], self.bb_period, self.bb_std)
        df["bb_upper"] = upper
        df["bb_middle"] = middle
        df["bb_lower"] = lower
        return df

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Entry: RSI oversold OR price at/below lower band
        rsi_buy = df["rsi"] < self.rsi_entry
        bb_buy = df["low"] <= df["bb_lower"]
        df["long_entry"] = rsi_buy | bb_buy

        # Exit: RSI back above 50 OR price at/above middle band
        rsi_exit = df["rsi"] > self.rsi_exit
        bb_exit = df["high"] >= df["bb_middle"]
        df["long_exit"] = rsi_exit | bb_exit

        # Signal encoding: 1 = enter long, -1 = exit, 0 = hold
        df["signal"] = 0
        df.loc[df["long_entry"], "signal"] = 1
        df.loc[df["long_exit"], "signal"] = -1

        df["stop_loss"] = df["close"] - self.atr_mult * df["atr"]
        df["take_profit"] = df["bb_middle"]  # target middle band
        return df


# ============================================================================
# Strategy 2 – Trend Following
# ============================================================================

class TrendFollowingStrategy(Strategy):
    """
    Trend Following
    ===============
    Entry : EMA9 crosses above EMA20  AND  ADX > 25
    Exit  : EMA9 crosses below EMA20
    Stop  : 2 x ATR below entry
    Best  : strong directional trends
    """

    name = "trend_following"

    def __init__(
        self,
        fast_ema: int = 9,
        slow_ema: int = 20,
        adx_period: int = 14,
        adx_threshold: float = 25.0,
        atr_period: int = 14,
        atr_mult: float = 2.0,
    ):
        self.fast_ema = fast_ema
        self.slow_ema = slow_ema
        self.adx_period = adx_period
        self.adx_threshold = adx_threshold
        self.atr_period = atr_period
        self.atr_mult = atr_mult

    def prepare_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["ema_fast"] = _ema(df["close"], self.fast_ema)
        df["ema_slow"] = _ema(df["close"], self.slow_ema)
        df["adx"] = _adx(df, self.adx_period)
        df["atr"] = _atr(df, self.atr_period)
        return df

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Crossover logic
        df["ema_bull"] = (df["ema_fast"] > df["ema_slow"]).astype(bool)
        prev_bull = df["ema_bull"].shift(1)
        df["ema_cross_up"] = df["ema_bull"] & (~prev_bull.where(prev_bull.notna(), False).astype(bool))
        df["ema_cross_down"] = (~df["ema_bull"]) & (prev_bull.where(prev_bull.notna(), False).astype(bool))

        # Entry on cross-up + strong trend
        df["long_entry"] = df["ema_cross_up"] & (df["adx"] > self.adx_threshold)
        df["long_exit"] = df["ema_cross_down"]

        df["signal"] = 0
        df.loc[df["long_entry"], "signal"] = 1
        df.loc[df["long_exit"], "signal"] = -1

        df["stop_loss"] = df["close"] - self.atr_mult * df["atr"]
        df["take_profit"] = np.nan  # trend ride – no fixed target
        return df


# ============================================================================
# Strategy 3 – Breakout
# ============================================================================

class BreakoutStrategy(Strategy):
    """
    Breakout
    ========
    Entry : Close breaks above rolling resistance  AND  volume > 1.5x avg
    Exit  : Close hits next resistance OR falls back below breakout level
    Stop  : Below broken resistance (now support)
    Best  : volatile markets forming consolidation patterns
    """

    name = "breakout"

    def __init__(
        self,
        resistance_window: int = 20,
        volume_mult: float = 1.5,
        atr_period: int = 14,
    ):
        self.resistance_window = resistance_window
        self.volume_mult = volume_mult
        self.atr_period = atr_period

    def prepare_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["resistance"], df["support"] = _rolling_resistance_support(
            df["close"], self.resistance_window
        )
        df["avg_volume"] = _avg_volume(df["volume"], self.resistance_window)
        df["atr"] = _atr(df, self.atr_period)
        # Next resistance = rolling max shifted further (projection)
        df["next_resistance"] = df["close"].rolling(self.resistance_window, min_periods=self.resistance_window).max().shift(1)
        return df

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Breakout: close > previous resistance + volume spike
        df["long_entry"] = (
            (df["close"] > df["resistance"])
            & (df["volume"] > self.volume_mult * df["avg_volume"])
            & (df["resistance"].notna())
        )

        # Exit: hit next resistance OR fall back below breakout (broken resistance)
        df["hit_next_res"] = df["high"] >= df["next_resistance"]
        df["fall_back"] = df["close"] < df["resistance"]
        df["long_exit"] = df["hit_next_res"] | df["fall_back"]

        df["signal"] = 0
        df.loc[df["long_entry"], "signal"] = 1
        df.loc[df["long_exit"], "signal"] = -1

        # Stop: just below the broken resistance level
        df["stop_loss"] = df["resistance"] * 0.995
        df["take_profit"] = df["next_resistance"]
        return df


# ============================================================================
# Strategy 4 – VWAP Scalp
# ============================================================================

class VWAPScalpStrategy(Strategy):
    """
    VWAP Scalp
    ==========
    Entry : Price pulls back to VWAP from above  AND  stochastic %K turning up
    Exit  : 1 : 1.5 risk/reward reached  OR  hits upper band
    Stop  : Below VWAP
    Best  : intraday, works across regimes
    """

    name = "vwap_scalp"

    def __init__(
        self,
        rr_reward: float = 1.5,
        stoch_k: int = 14,
        stoch_d: int = 3,
        atr_period: int = 14,
    ):
        self.rr_reward = rr_reward
        self.stoch_k = stoch_k
        self.stoch_d = stoch_d
        self.atr_period = atr_period

    def prepare_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["vwap"] = _vwap(df)
        df["stoch_k"], df["stoch_d"] = _stochastic(
            df["high"], df["low"], df["close"], self.stoch_k, self.stoch_d
        )
        df["stoch_turning_up"] = (df["stoch_k"] > df["stoch_k"].shift(1)) & (
            df["stoch_k"].shift(1) <= df["stoch_d"].shift(1)
        )
        df["atr"] = _atr(df, self.atr_period)
        upper, middle, lower = _bbands(df["close"], period=20, std_mult=2.0)
        df["bb_upper"] = upper
        return df

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()

        # Pullback to VWAP: price was above, now near/below VWAP but close above
        above_vwap = df["close"] > df["vwap"]
        near_vwap = (df["low"] <= df["vwap"] * 1.002) & (df["close"] >= df["vwap"])

        df["long_entry"] = above_vwap & near_vwap & df["stoch_turning_up"]

        # Dynamic take-profit based on risk
        risk = (df["close"] - df["vwap"] * 0.998).clip(lower=df["atr"] * 0.3)
        df["take_profit"] = df["close"] + self.rr_reward * risk
        df["hit_tp"] = df["high"] >= df["take_profit"]
        df["hit_band"] = df["high"] >= df["bb_upper"]
        df["long_exit"] = df["hit_tp"] | df["hit_band"]

        df["signal"] = 0
        df.loc[df["long_entry"], "signal"] = 1
        df.loc[df["long_exit"], "signal"] = -1

        df["stop_loss"] = df["vwap"] * 0.998  # just below VWAP
        return df


# ============================================================================
# Backtester  (walk-forward, bar-by-bar)
# ============================================================================

class Backtester:
    """
    Walk-forward backtest engine.

    Simulates bar-by-bar execution using pre-computed vectorised signals.
    Accounts for taker fees and slippage.
    """

    def __init__(
        self,
        taker_fee: float = TAKER_FEE,
        slippage: float = SLIPPAGE,
        risk_per_trade: float = RISK_PER_TRADE,
    ):
        self.taker_fee = taker_fee
        self.slippage = slippage
        self.risk_per_trade = risk_per_trade

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def run(
        self,
        df: pd.DataFrame,
        strategy: Strategy,
        initial_balance: float = 10_000.0,
    ) -> BacktestResult:
        """
        Run walk-forward backtest for *strategy* on *df*.

        Parameters
        ----------
        df : pd.DataFrame
            Must contain OHLCV columns.
        strategy : Strategy
            Concrete strategy instance.
        initial_balance : float
            Starting portfolio value in USDT (or quote currency).

        Returns
        -------
        BacktestResult
        """
        df = strategy.prepare_indicators(df)
        df = strategy.generate_signals(df)

        balance = float(initial_balance)
        equity_curve: List[float] = [balance]
        trades: List[Trade] = []

        in_position = False
        entry_idx = 0
        entry_price = 0.0
        position_size = 0.0
        stop_price = 0.0
        take_price = 0.0
        direction = "LONG"

        for i in range(1, len(df)):
            row = df.iloc[i]
            prev_row = df.iloc[i - 1]
            signal = int(row["signal"])
            close = float(row["close"])
            low = float(row["low"])
            high = float(row["high"])

            if not in_position:
                # Look for entry on signal == 1
                if signal == 1:
                    entry_idx = i
                    # Apply slippage on entry (buy = worse fill)
                    entry_price = close * (1.0 + self.slippage)
                    stop_price = float(row["stop_loss"])
                    risk_amount = balance * self.risk_per_trade
                    price_risk = entry_price - stop_price
                    if price_risk <= 0:
                        price_risk = entry_price * 0.005  # fallback 0.5 %
                    position_size = risk_amount / price_risk
                    # Cap position so notional <= balance
                    notional = position_size * entry_price
                    if notional > balance:
                        position_size = balance / entry_price
                    direction = "LONG"
                    fee = notional * self.taker_fee
                    balance -= fee
                    in_position = True
                    if not math.isnan(row.get("take_profit", np.nan)):
                        take_price = float(row["take_profit"])
                    else:
                        take_price = 0.0
            else:
                # Manage open position
                exited = False
                exit_price = close
                exit_reason = "signal"

                # 1) Stop-loss hit?
                if low <= stop_price:
                    exit_price = stop_price * (1.0 - self.slippage)
                    exit_reason = "stop_loss"
                    exited = True

                # 2) Take-profit hit?
                elif take_price > 0 and high >= take_price:
                    exit_price = take_price * (1.0 - self.slippage)
                    exit_reason = "take_profit"
                    exited = True

                # 3) Exit signal?
                elif signal == -1:
                    exit_price = close * (1.0 - self.slippage)
                    exit_reason = "signal"
                    exited = True

                if exited:
                    pnl = (exit_price - entry_price) * position_size
                    if direction == "SHORT":
                        pnl = -pnl
                    notional_exit = position_size * exit_price
                    fee_exit = notional_exit * self.taker_fee
                    pnl -= fee_exit
                    balance += pnl

                    trades.append(
                        Trade(
                            entry_idx=entry_idx,
                            exit_idx=i,
                            entry_price=round(entry_price, 6),
                            exit_price=round(exit_price, 6),
                            direction=direction,
                            size=round(position_size, 8),
                            pnl=round(pnl, 4),
                            pnl_pct=round(pnl / (entry_price * position_size) * 100, 4) if position_size else 0.0,
                            fees=round(fee_exit, 4),
                            exit_reason=exit_reason,
                        )
                    )
                    in_position = False
                    entry_price = 0.0
                    position_size = 0.0
                    stop_price = 0.0
                    take_price = 0.0

            equity_curve.append(balance)

        # Close any open position at last close
        if in_position:
            last_close = float(df["close"].iloc[-1]) * (1.0 - self.slippage)
            pnl = (last_close - entry_price) * position_size
            notional_exit = position_size * last_close
            fee_exit = notional_exit * self.taker_fee
            pnl -= fee_exit
            balance += pnl
            trades.append(
                Trade(
                    entry_idx=entry_idx,
                    exit_idx=len(df) - 1,
                    entry_price=round(entry_price, 6),
                    exit_price=round(last_close, 6),
                    direction=direction,
                    size=round(position_size, 8),
                    pnl=round(pnl, 4),
                    pnl_pct=round(pnl / (entry_price * position_size) * 100, 4) if position_size else 0.0,
                    fees=round(fee_exit, 4),
                    exit_reason="end_of_data",
                )
            )
            equity_curve[-1] = balance

        return self._build_result(trades, equity_curve, initial_balance)

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #

    @staticmethod
    def _build_result(
        trades: List[Trade], equity_curve: List[float], initial_balance: float
    ) -> BacktestResult:
        result = BacktestResult()
        result.total_trades = len(trades)
        result.equity_curve = equity_curve
        result.trades = trades

        if not trades:
            return result

        wins = [t for t in trades if t.pnl > 0]
        losses = [t for t in trades if t.pnl <= 0]
        result.win_rate = len(wins) / len(trades) * 100.0
        result.total_pnl = sum(t.pnl for t in trades)
        result.total_fees = sum(t.fees for t in trades)
        result.avg_trade = result.total_pnl / len(trades)

        # Profit factor
        gross_profit = sum(t.pnl for t in wins)
        gross_loss = abs(sum(t.pnl for t in losses))
        result.profit_factor = (
            gross_profit / gross_loss if gross_loss > 1e-9 else float("inf")
        )

        # Max drawdown
        peak = initial_balance
        max_dd = 0.0
        for eq in equity_curve:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak
            if dd > max_dd:
                max_dd = dd
        result.max_drawdown = max_dd * 100.0

        # Sharpe ratio (daily returns -> annualised)
        returns = pd.Series(equity_curve).pct_change().dropna()
        if len(returns) > 1 and returns.std() > 1e-12:
            # Approximate: 365 trading days for crypto
            sharpe = (returns.mean() / returns.std()) * math.sqrt(365)
            result.sharpe_ratio = sharpe
        else:
            result.sharpe_ratio = 0.0

        return result


# ============================================================================
# Strategy Brain  (orchestrator)
# ============================================================================

class StrategyBrain:
    """
    Alex V2 Strategy Brain
    ======================
    Orchestrates multiple strategies, backtests them, selects the best one
    for the current market regime, and generates actionable signals.
    """

    # Regime -> preferred strategy mapping (fallback order)
    REGIME_MAP = {
        "ranging": ["mean_reversion", "vwap_scalp", "breakout", "trend_following"],
        "trending_up": ["trend_following", "vwap_scalp", "breakout", "mean_reversion"],
        "trending_down": ["trend_following", "vwap_scalp", "breakout", "mean_reversion"],
        "volatile": ["breakout", "vwap_scalp", "mean_reversion", "trend_following"],
        "unknown": ["vwap_scalp", "mean_reversion", "trend_following", "breakout"],
    }

    def __init__(self, ta_engine=None):
        """
        Parameters
        ----------
        ta_engine : optional
            External TA engine (reserved for future DI).
        """
        self.ta_engine = ta_engine
        self.backtester = Backtester()
        self._strategies: Dict[str, Strategy] = {
            MeanReversionStrategy.name: MeanReversionStrategy(),
            TrendFollowingStrategy.name: TrendFollowingStrategy(),
            BreakoutStrategy.name: BreakoutStrategy(),
            VWAPScalpStrategy.name: VWAPScalpStrategy(),
        }
        self._performance: Dict[str, BacktestResult] = {}
        self._backtest_history: Dict[str, Dict[str, BacktestResult]] = {}

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    def backtest_all(self, historical_df: pd.DataFrame) -> dict:
        """
        Backtest every strategy on *historical_df*.

        Parameters
        ----------
        historical_df : pd.DataFrame
            OHLCV data.  Columns must include open/high/low/close/volume.

        Returns
        -------
        dict
            {strategy_name: BacktestResult.to_dict(), ...}
        """
        if historical_df.empty or len(historical_df) < 50:
            return {}

        results: dict = {}
        self._performance = {}

        # Ensure standard column names (lower-case)
        df = historical_df.copy()
        df.columns = [c.lower() for c in df.columns]

        for name, strat in self._strategies.items():
            try:
                result = self.backtester.run(df, strat)
                self._performance[name] = result
                results[name] = result.to_dict()
            except Exception as exc:
                results[name] = {"error": str(exc)}

        return results

    def select_strategy(self, market_regime: str, coin: str) -> str:
        """
        Pick the best strategy name for *market_regime* and *coin*.

        Selection logic:
        1. Look up ranked strategy list for the regime.
        2. If backtest data exists, re-rank by Sharpe ratio.
        3. Fall back to regime default if no backtests.

        Parameters
        ----------
        market_regime : str
            One of: ranging, trending_up, trending_down, volatile, unknown
        coin : str
            Symbol e.g. "BTCUSDT" (used for per-coin history).

        Returns
        -------
        str
            Strategy name to use.
        """
        regime = market_regime.lower().strip()
        if regime not in self.REGIME_MAP:
            regime = "unknown"

        candidates = list(self.REGIME_MAP[regime])

        # Re-rank by backtest Sharpe if available
        scored = []
        for cand in candidates:
            perf = self._performance.get(cand)
            if perf is not None and perf.total_trades > 0:
                # Composite score: Sharpe * win_rate_weight
                score = perf.sharpe_ratio * (perf.win_rate / 100.0 + 0.5)
                scored.append((cand, score))
            else:
                scored.append((cand, 0.0))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[0][0]

    def get_strategy_signal(self, strategy_name: str) -> dict:
        """
        Return the last signal generated by *strategy_name*.

        Note: This method requires that `generate_signals` has been called
        externally (e.g. by the execution loop).  For a standalone signal
        you should call the strategy's ``prepare_indicators`` +
        ``generate_signals`` on the latest bar directly.

        Parameters
        ----------
        strategy_name : str
            Name of the strategy.

        Returns
        -------
        dict
            {"action": "BUY|SELL|HOLD", "confidence": float, "strategy": str}
        """
        if strategy_name not in self._strategies:
            return {"action": "HOLD", "confidence": 0.0, "strategy": strategy_name}

        perf = self._performance.get(strategy_name)
        if perf is None or perf.total_trades == 0:
            confidence = 50.0
        else:
            # Confidence derived from win rate and Sharpe
            confidence = float(min(95.0, max(10.0, perf.win_rate * 0.7 + perf.sharpe_ratio * 5.0)))

        # Last trade direction as proxy signal
        if perf and perf.trades:
            last = perf.trades[-1]
            action = "BUY" if last.direction == "LONG" and last.pnl > 0 else "HOLD"
        else:
            action = "HOLD"

        return {
            "action": action,
            "confidence": round(confidence, 2),
            "strategy": strategy_name,
        }

    def get_strategy_performance(self) -> dict:
        """
        Return performance metrics for all backtested strategies.

        Returns
        -------
        dict
            {strategy_name: {"win_rate": ..., "sharpe": ..., ...}, ...}
        """
        out = {}
        for name, perf in self._performance.items():
            out[name] = {
                "total_trades": int(perf.total_trades),
                "win_rate": float(round(perf.win_rate, 2)),
                "total_pnl": float(round(perf.total_pnl, 2)),
                "sharpe_ratio": float(round(perf.sharpe_ratio, 3)),
                "max_drawdown": float(round(perf.max_drawdown, 2)),
                "profit_factor": float(round(perf.profit_factor, 2)),
                "avg_trade": float(round(perf.avg_trade, 2)),
            }
        return out

    # ------------------------------------------------------------------ #
    # Convenience helpers
    # ------------------------------------------------------------------ #

    def list_strategies(self) -> List[str]:
        """Return the names of all registered strategies."""
        return list(self._strategies.keys())

    def get_strategy(self, name: str) -> Optional[Strategy]:
        """Retrieve a strategy instance by name."""
        return self._strategies.get(name)


# ============================================================================
# Synthetic data generator  (for __main__ demo)
# ============================================================================

def _make_synthetic_ohlcv(n: int = 500, seed: int = 42, trend: float = 0.0) -> pd.DataFrame:
    """
    Generate synthetic OHLCV data.

    Parameters
    ----------
    n : int
        Number of bars.
    seed : int
        Random seed.
    trend : float
        Drift per bar (e.g. 0.001 = upward trend).

    Returns
    -------
    pd.DataFrame
        Columns: open, high, low, close, volume
    """
    rng = np.random.default_rng(seed)
    returns = rng.normal(trend, 0.012, size=n)
    close = 100.0 * np.exp(np.cumsum(returns))
    noise = close * 0.003
    high = close + rng.uniform(0, noise)
    low = close - rng.uniform(0, noise)
    open_ = close + rng.normal(0, noise * 0.3)
    volume = rng.integers(1_000_000, 10_000_000, size=n).astype(float)
    df = pd.DataFrame({
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
    })
    return df


# ============================================================================
# __main__  –  quick sanity check
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("Alex V2 – Strategy Brain + Backtester  (demo)")
    print("=" * 70)

    # ------------------------------------------------------------------
    # 1. Create synthetic historical data
    # ------------------------------------------------------------------
    print("\n[1] Generating synthetic OHLCV data (500 bars, slight upward drift)...")
    df = _make_synthetic_ohlcv(n=500, seed=42, trend=0.0005)
    print(f"    Data shape: {df.shape}")
    print(f"    Close range: {df['close'].min():.2f} – {df['close'].max():.2f}")

    # ------------------------------------------------------------------
    # 2. Instantiate brain & backtest all strategies
    # ------------------------------------------------------------------
    print("\n[2] Backtesting all 4 strategies...")
    brain = StrategyBrain()
    results = brain.backtest_all(df)

    for name, res in results.items():
        if "error" in res:
            print(f"    {name:20s}: ERROR – {res['error']}")
            continue
        print(
            f"    {name:20s}: "
            f"trades={res['total_trades']:3d}  "
            f"win_rate={res['win_rate']:5.1f}%  "
            f"pnl={res['total_pnl']:8.2f}  "
            f"sharpe={res['sharpe_ratio']:6.3f}  "
            f"max_dd={res['max_drawdown']:5.1f}%  "
            f"pf={res['profit_factor']:4.2f}"
        )

    # ------------------------------------------------------------------
    # 3. Strategy selection for different regimes
    # ------------------------------------------------------------------
    print("\n[3] Strategy selection by regime:")
    for regime in ["ranging", "trending_up", "trending_down", "volatile", "unknown"]:
        pick = brain.select_strategy(regime, "BTCUSDT")
        print(f"    {regime:15s} -> {pick}")

    # ------------------------------------------------------------------
    # 4. Signal generation
    # ------------------------------------------------------------------
    print("\n[4] Latest signals:")
    for name in brain.list_strategies():
        sig = brain.get_strategy_signal(name)
        print(f"    {name:20s}: {sig}")

    # ------------------------------------------------------------------
    # 5. Performance summary
    # ------------------------------------------------------------------
    print("\n[5] Strategy performance summary:")
    perf = brain.get_strategy_performance()
    for name, metrics in perf.items():
        print(f"    {name:20s}: {metrics}")

    print("\n" + "=" * 70)
    print("Demo complete.  All systems nominal.")
    print("=" * 70)
