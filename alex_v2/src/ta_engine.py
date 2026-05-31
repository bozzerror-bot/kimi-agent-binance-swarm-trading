"""
Alex V2 — Technical Analysis Engine
====================================
Advanced indicator system for crypto futures scalping on Binance.
Provides RSI, MACD, Bollinger Bands, EMA, VWAP, Stochastic, ADX,
ATR, OBV, plus pivot-based S/R detection, automatic trendline fitting,
market regime classification, and a unified signal summary.

Interfaces expected by other Alex V2 components:
    - calculate_all_indicators()  -> pd.DataFrame with indicator columns
    - detect_support_resistance() -> dict of S/R levels
    - detect_trendlines()         -> dict of uptrend / downtrend lines
    - detect_market_regime()      -> str regime label
    - get_vwap()                  -> float
    - get_atr(period)             -> float
    - get_signal_summary()        -> dict of all current signals

Usage
-----
    df = pd.read_parquet("bars_1m.parquet")
    ta = TAEngine(df)
    df = ta.calculate_all_indicators()
    regime = ta.detect_market_regime()
    signals = ta.get_signal_summary()
"""

from __future__ import annotations

import warnings
from typing import Any

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------
_RSI_PERIOD: int = 14
_MACD_FAST: int = 12
_MACD_SLOW: int = 26
_MACD_SIGNAL: int = 9
_BB_PERIOD: int = 20
_BB_STD: float = 2.0
_EMA_PERIODS: tuple[int, ...] = (9, 20, 50)
_STOCH_K: int = 14
_STOCH_D: int = 3
_STOCH_SMOOTH: int = 3
_ADX_PERIOD: int = 14
_ATR_PERIOD: int = 14

_PIVOT_WINDOW: int = 5
_SR_CLUSTER_PCT: float = 0.005        # 0.5 % clustering threshold
_SR_TOP_N: int = 3                    # top-3 support / resistance levels

_TRENDLINE_MIN_TOUCHES: int = 3
_TRENDLINE_MAX_DEV_PCT: float = 0.003  # 0.3 % max deviation

# ADX / BB-width regime thresholds
_REGIME_ADX_STRONG: float = 25.0
_REGIME_ADX_WEAK: float = 20.0
_REGIME_BB_WIDE: float = 0.03
_REGIME_BB_NARROW: float = 0.015

warnings.filterwarnings("ignore", category=FutureWarning)


# ===========================================================================
# Helper functions
# ===========================================================================

def _validate_df(df: pd.DataFrame) -> None:
    """Raise ValueError if required columns are missing."""
    required = {"open", "high", "low", "close", "volume"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"DataFrame missing required columns: {missing}")


def _ensure_ohlc(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy with OHLCV lower-cased columns."""
    rename_map = {
        "Open": "open", "High": "high", "Low": "low",
        "Close": "close", "Volume": "volume",
    }
    df = df.copy()
    df.rename(columns={k: v for k, v in rename_map.items() if k in df.columns},
              inplace=True)
    return df


# ===========================================================================
# Indicator builders — pure functions over Series / DataFrames
# ===========================================================================

def _rsi(series: pd.Series, period: int = _RSI_PERIOD) -> pd.Series:
    """Compute the Relative Strength Index (RSI).

    Parameters
    ----------
    series : pd.Series
        Price series (typically ``close``).
    period : int
        Look-back window (default 14).

    Returns
    -------
    pd.Series
        RSI values in [0, 100].
    """
    delta = series.diff()
    gain = delta.clip(lower=0.0)
    loss = (-delta).clip(lower=0.0)

    avg_gain = gain.ewm(alpha=1.0 / period, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, min_periods=period).mean()

    rs = avg_gain / avg_loss.replace(0.0, np.nan)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi.fillna(50.0)  # neutral until enough data


def _macd(
    series: pd.Series,
    fast: int = _MACD_FAST,
    slow: int = _MACD_SLOW,
    signal: int = _MACD_SIGNAL,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Compute MACD line, signal line, and histogram.

    Returns
    -------
    macd_line, signal_line, histogram : pd.Series
    """
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def _bollinger(
    series: pd.Series,
    period: int = _BB_PERIOD,
    num_std: float = _BB_STD,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Compute Bollinger Bands.

    Returns
    -------
    upper_band, middle_band, lower_band : pd.Series
    """
    middle = series.rolling(window=period, min_periods=period).mean()
    std = series.rolling(window=period, min_periods=period).std()
    upper = middle + num_std * std
    lower = middle - num_std * std
    return upper, middle, lower


def _vwap(high: pd.Series, low: pd.Series, close: pd.Series,
          volume: pd.Series) -> pd.Series:
    """Compute the Volume-Weighted Average Price (VWAP).

    Uses the typical price  (H + L + C) / 3  as the price anchor.

    Returns
    -------
    pd.Series
        Cumulative VWAP from the start of the series.
    """
    typical = (high + low + close) / 3.0
    cum_vol = volume.cumsum()
    cum_tp_vol = (typical * volume).cumsum()
    return cum_tp_vol / cum_vol.replace(0.0, np.nan)


def _stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    k_period: int = _STOCH_K,
    d_period: int = _STOCH_D,
    smooth_k: int = _STOCH_SMOOTH,
) -> tuple[pd.Series, pd.Series]:
    """Compute Stochastic Oscillator (%K and %D).

    Returns
    -------
    k_line, d_line : pd.Series
    """
    lowest_low = low.rolling(window=k_period, min_periods=k_period).min()
    highest_high = high.rolling(window=k_period, min_periods=k_period).max()
    range_hl = highest_high - lowest_low
    range_hl = range_hl.replace(0.0, np.nan)

    raw_k = 100.0 * (close - lowest_low) / range_hl
    k_line = raw_k.rolling(window=smooth_k, min_periods=smooth_k).mean()
    d_line = k_line.rolling(window=d_period, min_periods=d_period).mean()
    return k_line.fillna(50.0), d_line.fillna(50.0)


def _atr(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = _ATR_PERIOD,
) -> pd.Series:
    """Compute Average True Range (ATR).

    Uses the smoothing method (Wilder's) via ``ewm``.

    Returns
    -------
    pd.Series
    """
    prev_close = close.shift(1)
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    atr = tr.ewm(alpha=1.0 / period, min_periods=period).mean()
    return atr


def _adx(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = _ADX_PERIOD,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Compute ADX, +DI, and -DI.

    Returns
    -------
    adx, plus_di, minus_di : pd.Series
    """
    prev_high = high.shift(1)
    prev_low = low.shift(1)
    prev_close = close.shift(1)

    # True Range
    tr1 = high - low
    tr2 = (high - prev_close).abs()
    tr3 = (low - prev_close).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    # Directional Movement
    plus_dm = (high - prev_high).clip(lower=0.0)
    minus_dm = (prev_low - low).clip(lower=0.0)
    plus_dm = plus_dm.where(plus_dm > minus_dm, 0.0)
    minus_dm = minus_dm.where(minus_dm > plus_dm, 0.0)

    # Smoothed sums
    atr = tr.ewm(alpha=1.0 / period, min_periods=period).mean()
    sm_plus_dm = plus_dm.ewm(alpha=1.0 / period, min_periods=period).mean()
    sm_minus_dm = minus_dm.ewm(alpha=1.0 / period, min_periods=period).mean()

    plus_di = 100.0 * sm_plus_dm / atr.replace(0.0, np.nan)
    minus_di = 100.0 * sm_minus_dm / atr.replace(0.0, np.nan)

    dx = 100.0 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0.0, np.nan)
    adx = dx.ewm(alpha=1.0 / period, min_periods=period).mean()

    return adx, plus_di, minus_di


def _obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    """Compute On-Balance Volume (OBV).

    Returns
    -------
    pd.Series
    """
    direction = np.sign(close.diff()).fillna(0.0)
    return (direction * volume).cumsum()


# ===========================================================================
# Pivot / S-R helpers
# ===========================================================================

def _detect_pivots(high: pd.Series, low: pd.Series, window: int) -> tuple[np.ndarray, np.ndarray]:
    """Return pivot-high and pivot-low boolean masks.

    A pivot high is a local maximum with *window* bars on each side.
    A pivot low  is a local minimum with *window* bars on each side.

    Parameters
    ----------
    high, low : pd.Series
    window : int
        Bars to each side of the candidate pivot.

    Returns
    -------
    pivot_highs, pivot_lows : np.ndarray (bool)
    """
    # Rolling max/min — the centre must equal the extreme
    roll_max = high.rolling(window=2 * window + 1, center=True).max()
    roll_min = low.rolling(window=2 * window + 1, center=True).min()

    pivot_highs = (high == roll_max).to_numpy()
    pivot_lows = (low == roll_min).to_numpy()

    # Exclude the edges where the window is incomplete
    pivot_highs[:window] = False
    pivot_highs[-window:] = False
    pivot_lows[:window] = False
    pivot_lows[-window:] = False

    return pivot_highs, pivot_lows


def _cluster_levels(levels: np.ndarray, threshold_pct: float) -> list[float]:
    """Cluster nearby price levels and return their centroids.

    Parameters
    ----------
    levels : np.ndarray
        Raw pivot prices (unsorted).
    threshold_pct : float
        Fraction of a level's value used as the clustering radius.

    Returns
    -------
    list[float]
        Clustered levels sorted descending.
    """
    if len(levels) == 0:
        return []

    levels = np.sort(levels)
    clusters: list[list[float]] = []
    current_cluster = [levels[0]]

    for lvl in levels[1:]:
        # threshold based on the first element of the current cluster
        threshold = current_cluster[0] * threshold_pct
        if abs(lvl - current_cluster[0]) <= threshold:
            current_cluster.append(lvl)
        else:
            clusters.append(current_cluster)
            current_cluster = [lvl]
    clusters.append(current_cluster)

    centroids = [np.mean(c) for c in clusters]
    # Sort descending so highest levels are first (conventional for resistance)
    return sorted(centroids, reverse=True)


# ===========================================================================
# Trendline helpers
# ===========================================================================

def _fit_trendline(pivots_idx: np.ndarray, pivots_val: np.ndarray) -> dict[str, Any] | None:
    """Fit a line through pivot points via linear regression.

    Parameters
    ----------
    pivots_idx : np.ndarray
        Integer indices of the pivots.
    pivots_val : np.ndarray
        Price values at those indices.

    Returns
    -------
    dict | None
        {slope, intercept, touches, strength, r2} or None if insufficient points.
    """
    if len(pivots_idx) < _TRENDLINE_MIN_TOUCHES:
        return None

    # Use the last 20 pivots at most to keep the line recent
    if len(pivots_idx) > 20:
        pivots_idx = pivots_idx[-20:]
        pivots_val = pivots_val[-20:]

    x = pivots_idx.astype(float)
    y = pivots_val.astype(float)

    # Linear regression via least squares
    A = np.vstack([x, np.ones_like(x)]).T
    slope, intercept = np.linalg.lstsq(A, y, rcond=None)[0]

    predicted = slope * x + intercept
    residuals = y - predicted
    ss_res = np.sum(residuals ** 2)
    ss_tot = np.sum((y - np.mean(y)) ** 2)
    r2 = 1.0 - ss_res / ss_tot if ss_tot > 0 else 0.0

    # Count touches within max deviation
    max_dev = np.mean(y) * _TRENDLINE_MAX_DEV_PCT
    touches = int(np.sum(np.abs(residuals) <= max_dev))

    strength = min(1.0, touches / 5.0) * max(0.0, r2)

    return {
        "slope": float(slope),
        "intercept": float(intercept),
        "touches": touches,
        "strength": round(float(strength), 4),
        "r2": round(float(r2), 4),
        "deviation_pct": round(float(np.mean(np.abs(residuals)) / np.mean(y) * 100), 4),
    }


# ===========================================================================
# TAEngine — main class
# ===========================================================================

class TAEngine:
    """Technical Analysis Engine for Alex V2 scalping bot.

    Parameters
    ----------
    prices_df : pd.DataFrame
        Must contain at least ``open``, ``high``, ``low``, ``close``,
        ``volume``.  Optional ``symbol`` column is preserved.

    Attributes
    ----------
    df : pd.DataFrame
        Working copy of the price data ( mutated in-place by
        ``calculate_all_indicators`` ).
    """

    # ------------------------------------------------------------------
    def __init__(self, prices_df: pd.DataFrame) -> None:
        self.df = _ensure_ohlc(prices_df.copy())
        _validate_df(self.df)
        # Ensure index is monotonic (time-based index expected)
        if not self.df.index.is_monotonic_increasing:
            self.df = self.df.sort_index()

    # ------------------------------------------------------------------
    def calculate_all_indicators(self) -> pd.DataFrame:
        """Calculate and append every indicator column to ``self.df``.

        Columns added
        -------------
        ``rsi_14``, ``macd``, ``macd_signal``, ``macd_hist``,
        ``bb_upper``, ``bb_middle``, ``bb_lower``, ``bb_width``,
        ``ema_9``, ``ema_20``, ``ema_50``,
        ``vwap``, ``stoch_k``, ``stoch_d``,
        ``atr_14``, ``adx``, ``plus_di``, ``minus_di``,
        ``obv``

        Returns
        -------
        pd.DataFrame
            The updated DataFrame (same object as ``self.df``).
        """
        df = self.df
        close = df["close"]
        high = df["high"]
        low = df["low"]
        open_ = df["open"]
        volume = df["volume"]

        # --- RSI ---
        df["rsi_14"] = _rsi(close, _RSI_PERIOD)

        # --- MACD ---
        macd_line, signal_line, hist = _macd(close)
        df["macd"] = macd_line
        df["macd_signal"] = signal_line
        df["macd_hist"] = hist

        # --- Bollinger Bands ---
        bb_up, bb_mid, bb_low = _bollinger(close)
        df["bb_upper"] = bb_up
        df["bb_middle"] = bb_mid
        df["bb_lower"] = bb_low
        df["bb_width"] = (bb_up - bb_low) / bb_mid.replace(0.0, np.nan)

        # --- EMAs ---
        for p in _EMA_PERIODS:
            df[f"ema_{p}"] = close.ewm(span=p, adjust=False).mean()

        # --- VWAP ---
        df["vwap"] = _vwap(high, low, close, volume)

        # --- Stochastic ---
        stoch_k, stoch_d = _stochastic(high, low, close)
        df["stoch_k"] = stoch_k
        df["stoch_d"] = stoch_d

        # --- ATR ---
        df["atr_14"] = _atr(high, low, close, _ATR_PERIOD)

        # --- ADX (+DI / -DI) ---
        adx, plus_di, minus_di = _adx(high, low, close, _ADX_PERIOD)
        df["adx"] = adx
        df["plus_di"] = plus_di
        df["minus_di"] = minus_di

        # --- OBV ---
        df["obv"] = _obv(close, volume)

        return df

    # ------------------------------------------------------------------
    def detect_support_resistance(self, window: int = 20) -> dict:
        """Detect support and resistance levels using pivot-point clustering.

        Algorithm
        ---------
        1. Find local maxima in ``high`` and local minima in ``low``
           using a rolling window of ``window`` bars on each side.
        2. Cluster nearby levels that fall within ``0.5 %`` of each other.
        3. Return the top-3 strongest resistance (highest) and
           top-3 strongest support (lowest) levels.

        Parameters
        ----------
        window : int
            Half-window size for pivot detection (default 20).

        Returns
        -------
        dict
            ``{"resistance": [r1, r2, r3], "support": [s1, s2, s3]}``
        """
        df = self.df
        if len(df) < 2 * window + 1:
            return {"resistance": [], "support": []}

        high = df["high"]
        low = df["low"]

        pivot_highs, pivot_lows = _detect_pivots(high, low, window)

        resistance_prices = high.to_numpy()[pivot_highs]
        support_prices = low.to_numpy()[pivot_lows]

        clustered_resistance = _cluster_levels(resistance_prices, _SR_CLUSTER_PCT)
        clustered_support = _cluster_levels(support_prices, _SR_CLUSTER_PCT)

        # Resistance = highest levels (already sorted descending)
        top_resistance = clustered_resistance[:_SR_TOP_N]
        # Support = lowest levels (reverse the sorted list)
        top_support = sorted(clustered_support)[:_SR_TOP_N]

        return {
            "resistance": [round(float(x), 6) for x in top_resistance],
            "support": [round(float(x), 6) for x in top_support],
        }

    # ------------------------------------------------------------------
    def detect_trendlines(self) -> dict:
        """Detect uptrend and downtrend lines from pivot points.

        Algorithm
        ---------
        1. Find pivot lows  -> fit uptrend line.
        2. Find pivot highs -> fit downtrend line.
        3. Linear regression on aligned pivots (last 20).
        4. Validate: at least 3 touches, max deviation 0.3 %.

        Returns
        -------
        dict
            ``{
                "uptrend":   {"slope", "intercept", "touches", "strength", "r2", ...} | None,
                "downtrend": {"slope", "intercept", "touches", "strength", "r2", ...} | None,
            }``
        """
        df = self.df
        if len(df) < 2 * _PIVOT_WINDOW + 1:
            return {"uptrend": None, "downtrend": None}

        high = df["high"]
        low = df["low"]
        close = df["close"]
        idx = np.arange(len(df))

        pivot_highs, pivot_lows = _detect_pivots(high, low, _PIVOT_WINDOW)

        # --- Uptrend line (through pivot lows) ---
        low_idx = idx[pivot_lows]
        low_val = low.to_numpy()[pivot_lows]
        uptrend = _fit_trendline(low_idx, low_val)

        # --- Downtrend line (through pivot highs) ---
        high_idx = idx[pivot_highs]
        high_val = high.to_numpy()[pivot_highs]
        downtrend = _fit_trendline(high_idx, high_val)

        # Add current price context
        current_price = float(close.iloc[-1])
        if uptrend is not None:
            uptrend["current_price"] = current_price
            uptrend["distance_pct"] = round(
                (current_price - (uptrend["slope"] * idx[-1] + uptrend["intercept"]))
                / current_price * 100, 4
            )
        if downtrend is not None:
            downtrend["current_price"] = current_price
            downtrend["distance_pct"] = round(
                ((downtrend["slope"] * idx[-1] + downtrend["intercept"]) - current_price)
                / current_price * 100, 4
            )

        return {"uptrend": uptrend, "downtrend": downtrend}

    # ------------------------------------------------------------------
    def detect_market_regime(self) -> str:
        """Classify the current market regime.

        Uses the most recent ADX value and Bollinger-Band width to decide
        between *trending*, *ranging*, *volatile*, and *mixed*.

        Returns
        -------
        str
            One of ``"trending"``, ``"ranging"``, ``"volatile"``, ``"mixed"``.
        """
        df = self.df
        if "adx" not in df.columns or "bb_width" not in df.columns:
            raise RuntimeError(
                "Indicators not calculated. Call calculate_all_indicators() first."
            )

        adx = float(df["adx"].iloc[-1])
        bb_width = float(df["bb_width"].iloc[-1])

        if adx > _REGIME_ADX_STRONG and bb_width > _REGIME_BB_NARROW:
            return "trending"
        elif adx < _REGIME_ADX_WEAK and bb_width < _REGIME_BB_NARROW:
            return "ranging"
        elif bb_width > _REGIME_BB_WIDE:
            return "volatile"
        else:
            return "mixed"

    # ------------------------------------------------------------------
    def get_vwap(self) -> float:
        """Return the most recent VWAP value.

        Returns
        -------
        float
        """
        if "vwap" not in self.df.columns:
            self.df["vwap"] = _vwap(
                self.df["high"], self.df["low"], self.df["close"], self.df["volume"]
            )
        return float(self.df["vwap"].iloc[-1])

    # ------------------------------------------------------------------
    def get_atr(self, period: int = _ATR_PERIOD) -> float:
        """Return the most recent ATR value.

        Parameters
        ----------
        period : int
            ATR look-back (default 14).

        Returns
        -------
        float
        """
        col = f"atr_{period}"
        if col not in self.df.columns:
            self.df[col] = _atr(self.df["high"], self.df["low"], self.df["close"], period)
        return float(self.df[col].iloc[-1])

    # ------------------------------------------------------------------
    def get_signal_summary(self) -> dict:
        """Aggregate all current indicator readings into a single dict.

        This is the primary interface used by the strategy-brain component
        to make trading decisions.

        Returns
        -------
        dict
            Structured signal summary including:
            * price & regime
            * trend (EMA alignment)
            * momentum (RSI, MACD, Stochastic)
            * volatility (ATR, BB position)
            * volume (OBV direction)
            * S/R levels
            * trendlines
            * composite signal score (-5 … +5)
        """
        df = self.df
        if "rsi_14" not in df.columns:
            self.calculate_all_indicators()

        last = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else last

        # --- Basic price info ---
        current_price = float(last["close"])
        summary: dict[str, Any] = {
            "price": current_price,
            "timestamp": str(df.index[-1]) if hasattr(df.index[-1], "isoformat") else df.index[-1],
        }

        # --- Regime ---
        summary["regime"] = self.detect_market_regime()

        # --- Trend (EMA alignment) ---
        ema_9 = float(last["ema_9"])
        ema_20 = float(last["ema_20"])
        ema_50 = float(last["ema_50"])
        summary["trend"] = {
            "ema_9": round(ema_9, 6),
            "ema_20": round(ema_20, 6),
            "ema_50": round(ema_50, 6),
            "alignment": "bullish" if ema_9 > ema_20 > ema_50 else (
                "bearish" if ema_9 < ema_20 < ema_50 else "mixed"
            ),
            "price_vs_ema9": round((current_price - ema_9) / ema_9 * 100, 4),
        }

        # --- Momentum ---
        rsi = float(last["rsi_14"])
        macd_val = float(last["macd"])
        macd_sig = float(last["macd_signal"])
        stoch_k = float(last["stoch_k"])
        stoch_d = float(last["stoch_d"])
        summary["momentum"] = {
            "rsi": round(rsi, 2),
            "rsi_signal": "overbought" if rsi > 70 else ("oversold" if rsi < 30 else "neutral"),
            "macd": round(macd_val, 6),
            "macd_signal": round(macd_sig, 6),
            "macd_hist": round(float(last["macd_hist"]), 6),
            "macd_cross": "bullish" if prev["macd"] <= prev["macd_signal"] and macd_val > macd_sig else (
                "bearish" if prev["macd"] >= prev["macd_signal"] and macd_val < macd_sig else "none"
            ),
            "stoch_k": round(stoch_k, 2),
            "stoch_d": round(stoch_d, 2),
            "stoch_signal": "overbought" if stoch_k > 80 else ("oversold" if stoch_k < 20 else "neutral"),
        }

        # --- Volatility ---
        atr = float(last["atr_14"])
        bb_upper = float(last["bb_upper"])
        bb_lower = float(last["bb_lower"])
        bb_middle = float(last["bb_middle"])
        bb_width = float(last["bb_width"])
        summary["volatility"] = {
            "atr_14": round(atr, 6),
            "atr_pct": round(atr / current_price * 100, 4),
            "bb_upper": round(bb_upper, 6),
            "bb_lower": round(bb_lower, 6),
            "bb_middle": round(bb_middle, 6),
            "bb_width": round(bb_width, 6),
            "bb_position": round((current_price - bb_lower) / (bb_upper - bb_lower) * 100, 2)
            if bb_upper != bb_lower else 50.0,
            "adx": round(float(last["adx"]), 2),
            "plus_di": round(float(last["plus_di"]), 2),
            "minus_di": round(float(last["minus_di"]), 2),
        }

        # --- Volume ---
        obv = float(last["obv"])
        obv_prev = float(prev["obv"])
        summary["volume"] = {
            "obv": round(obv, 2),
            "obv_direction": "rising" if obv > obv_prev else "falling",
            "vwap": round(float(last["vwap"]), 6),
            "price_vs_vwap": round((current_price - float(last["vwap"])) / float(last["vwap"]) * 100, 4),
        }

        # --- Support / Resistance ---
        summary["levels"] = self.detect_support_resistance()

        # --- Trendlines ---
        summary["trendlines"] = self.detect_trendlines()

        # --- Composite signal score (-5 to +5) ---
        score = 0
        # Trend contribution
        if summary["trend"]["alignment"] == "bullish":
            score += 1
        elif summary["trend"]["alignment"] == "bearish":
            score -= 1
        # RSI contribution
        if rsi < 30:
            score += 1
        elif rsi > 70:
            score -= 1
        # MACD contribution
        if macd_val > macd_sig:
            score += 1
        elif macd_val < macd_sig:
            score -= 1
        # Stochastic contribution
        if stoch_k < 20 and stoch_d < 20:
            score += 1
        elif stoch_k > 80 and stoch_d > 80:
            score -= 1
        # ADX contribution (only if strong trend)
        if float(last["adx"]) > 25:
            if float(last["plus_di"]) > float(last["minus_di"]):
                score += 1
            else:
                score -= 1
        # OBV confirmation
        if summary["volume"]["obv_direction"] == "rising":
            score += 1
        else:
            score -= 1

        summary["composite_score"] = max(-5, min(5, score))
        summary["recommendation"] = (
            "strong_buy" if score >= 4 else
            "buy" if score >= 2 else
            "weak_buy" if score >= 1 else
            "neutral" if score == 0 else
            "weak_sell" if score >= -1 else
            "sell" if score >= -3 else
            "strong_sell"
        )

        return summary


# ===========================================================================
# Example usage
# ===========================================================================

if __name__ == "__main__":
    # --- Synthetic 1-minute OHLCV data (200 bars) ---
    np.random.seed(42)
    n = 200
    t = pd.date_range("2024-01-01", periods=n, freq="1min")

    # Generate a synthetic trending + noisy price series
    trend = np.linspace(100, 120, n)  # uptrend
    noise = np.cumsum(np.random.randn(n) * 0.3)
    close = trend + noise
    close = np.maximum(close, 1.0)  # safety floor

    high = close + np.abs(np.random.randn(n) * 0.5)
    low = close - np.abs(np.random.randn(n) * 0.5)
    low = np.minimum(low, high)  # sanity
    open_ = close + np.random.randn(n) * 0.2
    volume = np.random.randint(100, 10000, size=n)

    df = pd.DataFrame({
        "open": open_,
        "high": high,
        "low": low,
        "close": close,
        "volume": volume,
        "symbol": "BTCUSDT",
    }, index=t)

    # --- Run the engine ---
    engine = TAEngine(df)
    df_ind = engine.calculate_all_indicators()

    print("=" * 60)
    print("Alex V2 — Technical Analysis Engine Demo")
    print("=" * 60)

    print("\n--- Indicator Columns ---")
    indicator_cols = [c for c in df_ind.columns if c not in
                      {"open", "high", "low", "close", "volume", "symbol"}]
    print(indicator_cols)

    print("\n--- Last Bar Indicators ---")
    print(df_ind[indicator_cols].iloc[-1].round(4).to_string())

    print("\n--- Market Regime ---")
    print(engine.detect_market_regime())

    print("\n--- Support / Resistance ---")
    print(engine.detect_support_resistance())

    print("\n--- Trendlines ---")
    tl = engine.detect_trendlines()
    print(f"  Uptrend:  {tl['uptrend']}")
    print(f"  Downtrend: {tl['downtrend']}")

    print("\n--- VWAP & ATR ---")
    print(f"  VWAP: {engine.get_vwap():.4f}")
    print(f"  ATR(14): {engine.get_atr():.4f}")

    print("\n--- Signal Summary ---")
    summary = engine.get_signal_summary()
    for key, val in summary.items():
        if isinstance(val, dict):
            print(f"  {key}:")
            for k2, v2 in val.items():
                print(f"    {k2}: {v2}")
        else:
            print(f"  {key}: {val}")

    print("\n" + "=" * 60)
    print("TA Engine demo complete.")
    print("=" * 60)
