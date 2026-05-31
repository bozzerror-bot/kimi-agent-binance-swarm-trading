"""
Alex V2 — Enhanced Personality & Orchestrator Engine
====================================================
A human-like AI scalper personality system with emotional modeling,
adaptive learning, stress management, and decision-making heuristics.

Key Improvements Over V1:
- 10-second analysis cycles, no hesitation on A+ setups
- Stress decays over time (not just from wins)
- Strategy-aware: knows which strategy is active and why
- Coin memory: remembers which coins trade well
- Market context: understands trending/ranging/volatile conditions
- Learning loop: adjusts confidence per strategy based on recent results

Author: AI Behavioral Systems Developer
"""

import json
import time
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Default Personality Configuration
# ---------------------------------------------------------------------------

DEFAULT_CONFIG = {
    "name": "Alex",
    "risk_tolerance": 0.75,         # Higher for scalping (0-1)
    "confidence_level": 0.70,       # Base confidence
    "patience": 0.40,               # LOWER = faster trades for scalping
    "adaptability": 0.85,           # HIGH = learns fast from mistakes
    "stress_decay_rate": 0.15,      # How fast stress goes down per cycle
    "stress_threshold": 0.70,       # Above this, reduce position size
    "max_stress": 0.85,             # Above this, skip trades entirely
    "momentum_bias": 0.60,          # Prefer trading with momentum
    "fomo_resistance": 0.80,        # Resistance to FOMO (high = disciplined)
    "strategy_preferences": {       # Which strategies Alex prefers
        "mean_reversion": 0.5,
        "trend_following": 0.5,
        "breakout": 0.5,
        "vwap_scalp": 0.5,
    },
    "coin_ratings": {},             # {"BTCUSDT": 0.8, "DOGEUSDT": 0.3}
    "session_stats": {              # Today's performance
        "trades_today": 0,
        "wins_today": 0,
        "losses_today": 0,
        "pnl_today": 0.0,
        "last_trade_time": None,
    },
}

# ---------------------------------------------------------------------------
# Mood Definitions — 9 Moods with Behavioural Effects
# ---------------------------------------------------------------------------

MOOD_EFFECTS = {
    "sharp": {
        "position_size_multiplier": 1.0,
        "speed_multiplier": 1.5,
        "min_signal_quality": 0.60,
        "description": "Full size, quick execution — Alex is in the zone",
    },
    "focused": {
        "position_size_multiplier": 1.0,
        "speed_multiplier": 1.0,
        "min_signal_quality": 0.55,
        "description": "Standard sizing, normal speed — business as usual",
    },
    "cautious": {
        "position_size_multiplier": 0.5,
        "speed_multiplier": 0.8,
        "min_signal_quality": 0.75,
        "description": "50% size, waits for A+ setups — licking wounds",
    },
    "hesitant": {
        "position_size_multiplier": 0.3,
        "speed_multiplier": 0.5,
        "min_signal_quality": 0.80,
        "description": "30% size, longer analysis — shaken confidence",
    },
    "fearful": {
        "position_size_multiplier": 0.0,
        "speed_multiplier": 0.0,
        "min_signal_quality": 1.0,
        "description": "No trades, market watching — preserving capital",
    },
    "greedy": {
        "position_size_multiplier": 1.2,
        "speed_multiplier": 1.2,
        "min_signal_quality": 0.50,
        "description": "Slight oversizing (capped at 120%) — feeling invincible",
    },
    "frustrated": {
        "position_size_multiplier": 0.0,
        "speed_multiplier": 0.0,
        "min_signal_quality": 1.0,
        "description": "Taking a breather — stop losses got annoying",
    },
    "confident": {
        "position_size_multiplier": 1.0,
        "speed_multiplier": 1.15,
        "min_signal_quality": 0.50,
        "description": "Normal size, slightly faster — consistency breeds confidence",
    },
    "neutral": {
        "position_size_multiplier": 1.0,
        "speed_multiplier": 1.0,
        "min_signal_quality": 0.55,
        "description": "Baseline behaviour — starting state",
    },
}

# ---------------------------------------------------------------------------
# Natural-Language Reasoning Templates
# ---------------------------------------------------------------------------

REASONING_TEMPLATES = {
    "mean_reversion": [
        "{symbol} is bouncing off support at ${price:,.2f} with RSI at {rsi:.0f} — oversold bounce incoming. Taking a quick long with {stop_size:.2f}x ATR stop.",
        "{symbol} hit the lower Bollinger Band at ${price:,.2f} and RSI is oversold at {rsi:.0f}. Mean reversion play here — expecting a snap back.",
        "{symbol} is {deviation:.1f}% below the VWAP — stretched too far. Quick long for the snap-back.",
        "RSI divergence on {symbol} at ${price:,.2f} — price making lower lows but RSI isn't. Reversal time.",
    ],
    "trend_following": [
        "{symbol} broke above resistance at ${price:,.2f} with {volume}x volume — momentum is real. Riding this trend.",
        "Clean higher highs and higher lows on {symbol}. Price at ${price:,.2f} with strong momentum — trend is your friend.",
        "{symbol} is grinding higher with every pullback being bought. ${price:,.2f} is holding — adding to the trend.",
        "EMA stack aligned bullish on {symbol} at ${price:,.2f}. Momentum is building — this trend has legs.",
    ],
    "breakout": [
        "{symbol} just broke out of a {duration}-hour consolidation at ${price:,.2f}. Volume confirmed — this is the real deal.",
        "{symbol} slicing through ${price:,.2f} resistance like butter. Breakout play with volume backing it.",
        "{symbol} forming a tight coil and now expanding range at ${price:,.2f}. Volatility expansion trade — expecting a big move.",
        "Clean break of the {level} level on {symbol} at ${price:,.2f}. Stop run triggered — riding the momentum.",
    ],
    "vwap_scalp": [
        "{symbol} is chopping around VWAP at ${price:,.2f} — no clear direction. Sitting this one out.",
        "{symbol} reclaimed VWAP at ${price:,.2f} with a sharp bounce. Quick scalp long — tight stop below VWAP.",
        "{symbol} losing VWAP at ${price:,.2f} and holding below. Short scalp — expecting continuation lower.",
        "VWAP slope turning up on {symbol} at ${price:,.2f} with price holding above. Bullish scalp setup.",
    ],
    "skip": [
        "{symbol} at ${price:,.2f} — price action is messy, no clear edge. Skipping this one.",
        "Not feeling the setup on {symbol} at ${price:,.2f}. Conditions aren't right — patience.",
        "{symbol} is in no-man's land at ${price:,.2f}. Waiting for a cleaner entry.",
        "Signal quality is too low on {symbol}. Better to miss a trade than take a bad one.",
    ],
    "post_win": [
        "That {symbol} trade worked out nicely — {pnl:+.2f}%. Sticking to the plan pays off.",
        "Clean win on {symbol}. {pnl:+.2f}% in the bag. Confidence is building.",
        "Nailed that {symbol} setup. {pnl:+.2f}% — one more win for the books.",
        " textbook execution on {symbol}. {pnl:+.2f}% profit. Staying sharp.",
    ],
    "post_loss": [
        "That last trade on {symbol} got stopped out by a wick — annoying but part of the game. Staying focused.",
        "Small loss on {symbol} ({pnl:.2f}%) — stopped out as planned. No regrets, that's risk management.",
        "Took the L on {symbol} ({pnl:.2f}%). Market conditions shifted. Resetting and moving on.",
        "Loss on {symbol} ({pnl:.2f}%) — the setup was valid, just didn't work. That's trading.",
    ],
    "post_frustrated": [
        "Three stops in a row... taking a quick breather. The market will still be there in 5 minutes.",
        "Stop losses are doing their job, but they're adding up. Stepping back to reset mentally.",
        "Frustration is creeping in — time to step away before I revenge trade. Discipline.",
    ],
}

# ---------------------------------------------------------------------------
# AlexBrain — Core Personality & Decision Engine
# ---------------------------------------------------------------------------


class AlexBrain:
    """
    Alex V2 Personality & Orchestrator Engine.

    Manages emotional state (stress, mood), adaptive learning from trade
    results, strategy-aware decision making, coin-specific memory, and
    natural-language reasoning generation.
    """

    # ------------------------------------------------------------------
    # Construction / Persistence
    # ------------------------------------------------------------------

    def __init__(self, config: Optional[dict] = None) -> None:
        """
        Initialise (or restore) Alex's personality state.

        Parameters
        ----------
        config : dict, optional
            Override defaults.  Keys that are absent fall back to
            ``DEFAULT_CONFIG``.
        """
        # Merge user config over defaults
        self.config = self._deep_merge(DEFAULT_CONFIG.copy(), config or {})

        # ---- emotional state ------------------------------------------------
        self.stress: float = 0.0          # 0.0 = zen, 1.0 = panic
        self.mood: str = "neutral"        # one of MOOD_EFFECTS keys
        self.mood_since: float = time.time()

        # ---- decision bookkeeping -------------------------------------------
        self._current_opportunity: Optional[dict] = None
        self._current_analysis: Optional[dict] = None
        self._last_decision: Optional[dict] = None
        self._consecutive_wins: int = 0
        self._consecutive_losses: int = 0
        self._frustration_cooldown_until: float = 0.0
        self._analysis_cycles: int = 0

        # ---- adaptive learning state ----------------------------------------
        self.strategy_performance: dict = {
            "mean_reversion":   {"wins": 0, "losses": 0, "pnl": 0.0, "confidence": 0.5},
            "trend_following":  {"wins": 0, "losses": 0, "pnl": 0.0, "confidence": 0.5},
            "breakout":         {"wins": 0, "losses": 0, "pnl": 0.0, "confidence": 0.5},
            "vwap_scalp":       {"wins": 0, "losses": 0, "pnl": 0.0, "confidence": 0.5},
        }

        # ---- coin memory ----------------------------------------------------
        # Persisted inside config["coin_ratings"] — keyed by symbol

        # ---- recent history (rolling window) --------------------------------
        self.trade_history: list = []     # last N trade results
        self.max_history: int = 50

        # ---- market context -------------------------------------------------
        self.market_context: str = "neutral"   # trending / ranging / volatile
        self.market_context_since: float = time.time()

        # ---- persistence ----------------------------------------------------
        self.state_file: Path = Path("alex_state.json")

        # Attempt to restore previous state
        self._load_state()
        self._update_mood()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _deep_merge(base: dict, override: dict) -> dict:
        """Recursively merge *override* into *base*."""
        result = base.copy()
        for key, val in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(val, dict):
                result[key] = AlexBrain._deep_merge(result[key], val)
            else:
                result[key] = val
        return result

    # ------------------------------------------------------------------
    # Stress System (Improved — decays naturally)
    # ------------------------------------------------------------------

    def update_stress(self, event: str) -> None:
        """
        Update Alex's stress level based on trading events.

        Stress now **decays naturally** every cycle and doesn't paralyse.
        Events:
            "win"                — big relief (-0.25)
            "loss"               — moderate increase (+0.20)
            "missed_opportunity" — actually reduces stress slightly (-0.05)
            "cycle"              — natural decay (-stress_decay_rate)
        """
        if event == "win":
            self.stress = max(0.0, self.stress - 0.25)
            self._consecutive_wins += 1
            self._consecutive_losses = 0
        elif event == "loss":
            self.stress = min(1.0, self.stress + 0.20)
            self._consecutive_losses += 1
            self._consecutive_wins = 0
        elif event == "missed_opportunity":
            # FOMO actually *reduces* stress — Alex feels relieved he didn't
            # chase a bad trade
            self.stress = max(0.0, self.stress - 0.05)
        elif event == "cycle":
            self.stress = max(0.0, self.stress - self.config["stress_decay_rate"])

        # Clamp
        self.stress = max(0.0, min(1.0, self.stress))
        self._update_mood()

    # ------------------------------------------------------------------
    # Mood System — 9 Moods
    # ------------------------------------------------------------------

    def _update_mood(self) -> None:
        """
        Determine Alex's current mood from stress level and recent trade
        history.  Called automatically after stress updates.
        """
        old_mood = self.mood
        now = time.time()

        # ---- frustration cooldown check -------------------------------------
        if self.mood == "frustrated" and now < self._frustration_cooldown_until:
            return   # still in timeout
        if self.mood == "frustrated" and now >= self._frustration_cooldown_until:
            self.mood = "neutral"   # cooldown expired

        # ---- mood selection logic -------------------------------------------
        wins = self._consecutive_wins
        losses = self._consecutive_losses
        stress = self.stress

        if losses >= 3 and stress > 0.65:
            self.mood = "fearful"
        elif losses >= 2:
            self.mood = "cautious"
        elif stress > self.config["max_stress"]:
            self.mood = "hesitant"
        elif stress > self.config["stress_threshold"] and losses >= 1:
            self.mood = "hesitant"
        elif wins >= 3 and stress < 0.30:
            self.mood = "sharp"
        elif wins >= 2:
            self.mood = "confident"
        elif wins >= 4 and stress < 0.40:
            self.mood = "greedy"
        else:
            # Default back to focused/neutral based on activity
            if self.config["session_stats"]["trades_today"] > 0:
                self.mood = "focused"
            else:
                self.mood = "neutral"

        # ---- frustration detection (repeated stop losses) --------------------
        recent_losses = sum(
            1 for t in self.trade_history[-5:]
            if t.get("result") == "loss"
        )
        if recent_losses >= 3 and self.mood not in ("fearful", "frustrated"):
            self.mood = "frustrated"
            self._frustration_cooldown_until = now + 300   # 5-minute breather

        # ---- timestamp mood change -------------------------------------------
        if self.mood != old_mood:
            self.mood_since = now

    def get_mood_effects(self) -> dict:
        """Return the behavioural modifiers for the current mood."""
        return MOOD_EFFECTS.get(self.mood, MOOD_EFFECTS["neutral"])

    # ------------------------------------------------------------------
    # Decision Speed System
    # ------------------------------------------------------------------

    def get_decision_timeline(self, signal_quality: float) -> str:
        """
        Return how fast Alex should act on a signal.

            > 0.85  -> "immediate"   (trade NOW)
            > 0.70  -> "fast"        (1-2 cycles)
            > 0.55  -> "standard"    (2-3 cycles analysis)
            <= 0.55 -> "skip"        (not worth it)
        """
        if signal_quality > 0.85:
            return "immediate"
        elif signal_quality > 0.70:
            return "fast"
        elif signal_quality > 0.55:
            return "standard"
        return "skip"

    # ------------------------------------------------------------------
    # Market Context Awareness
    # ------------------------------------------------------------------

    def set_market_context(self, context: str) -> None:
        """
        Set the current market regime.

        Parameters
        ----------
        context : str
            One of "trending", "ranging", "volatile", "neutral".
        """
        valid = {"trending", "ranging", "volatile", "neutral"}
        if context not in valid:
            raise ValueError(f"context must be one of {valid}")
        if context != self.market_context:
            self.market_context = context
            self.market_context_since = time.time()

    # ------------------------------------------------------------------
    # Strategy Performance Tracking
    # ------------------------------------------------------------------

    def _update_strategy_performance(self, strategy: str, result: str, pnl: float) -> None:
        """Update win/loss tracking and adaptive confidence for a strategy."""
        if strategy not in self.strategy_performance:
            return
        perf = self.strategy_performance[strategy]
        if result == "win":
            perf["wins"] += 1
        else:
            perf["losses"] += 1
        perf["pnl"] += pnl

        # ---- adaptive confidence adjustment --------------------------------
        # Confidence shifts based on recent results; bounded [0.2, 0.9]
        total = perf["wins"] + perf["losses"]
        if total > 0:
            win_rate = perf["wins"] / total
            # Blend with base confidence, weighted by adaptability
            adapt = self.config["adaptability"]
            base_conf = self.config["strategy_preferences"].get(strategy, 0.5)
            perf["confidence"] = max(
                0.2, min(0.9, base_conf * (1 - adapt) + win_rate * adapt)
            )

    def get_strategy_confidence(self, strategy: str) -> float:
        """Return Alex's current confidence in *strategy* (0-1)."""
        return self.strategy_performance.get(strategy, {}).get(
            "confidence", self.config["strategy_preferences"].get(strategy, 0.5)
        )

    # ------------------------------------------------------------------
    # Coin Memory — Track Performance Per Coin
    # ------------------------------------------------------------------

    def _update_coin_rating(self, symbol: str, result: str, pnl: float) -> None:
        """
        Adjust Alex's rating of a specific coin based on trade results.
        Rating is a float in [0.1, 1.0] — higher means Alex trades it better.
        """
        ratings = self.config.setdefault("coin_ratings", {})
        current = ratings.get(symbol, 0.5)
        adapt = self.config["adaptability"]

        if result == "win":
            delta = +0.05 * adapt
        else:
            delta = -0.03 * adapt

        # PNL magnitude adjustment
        if abs(pnl) > 1.0:
            delta *= min(2.0, abs(pnl))

        ratings[symbol] = max(0.1, min(1.0, current + delta))

    def get_coin_rating(self, symbol: str) -> float:
        """Return Alex's rating for *symbol* (0.1 - 1.0)."""
        return self.config.get("coin_ratings", {}).get(symbol, 0.5)

    # ------------------------------------------------------------------
    # Quick Pre-Filter
    # ------------------------------------------------------------------

    def should_trade_now(self) -> bool:
        """
        Quick filter called **before** full analysis.

        Returns ``False`` if Alex is too stressed, in cooldown, or the
        market conditions are unfavourable.
        """
        now = time.time()

        # Frustration cooldown
        if self.mood == "frustrated" and now < self._frustration_cooldown_until:
            return False

        # Max stress — no trading
        if self.stress >= self.config["max_stress"]:
            return False

        # Fearful mood — sitting out
        if self.mood == "fearful":
            return False

        # Patience check — don't overtrade
        stats = self.config["session_stats"]
        last = stats.get("last_trade_time")
        if last is not None:
            elapsed = now - last
            min_gap = 15.0 * self.config["patience"]   # seconds
            if elapsed < min_gap:
                return False

        return True

    # ------------------------------------------------------------------
    # Core Analysis & Decision Pipeline
    # ------------------------------------------------------------------

    def analyze_opportunity(
        self,
        coin_data: dict,
        strategy_signal: dict,
        ta_summary: dict,
    ) -> dict:
        """
        Evaluate a trading opportunity through Alex's personality lens.

        Parameters
        ----------
        coin_data : dict
            Must contain at least ``symbol`` and ``price``.
        strategy_signal : dict
            ``{"strategy": str, "direction": "long"|"short",
               "strength": float(0-1), "entry": float, "stop": float,
               "target": float}``
        ta_summary : dict
            ``{"rsi": float, "volume_ratio": float, "atr": float,
               "trend": "up"|"down"|"sideways", "support": float,
               "resistance": float}``

        Returns
        -------
        dict
            Full analysis with signal quality, position sizing, timeline,
            and human-readable reasoning.
        """
        self._analysis_cycles += 1
        self.update_stress("cycle")   # natural stress decay

        symbol = coin_data.get("symbol", "UNKNOWN")
        price = coin_data.get("price", 0.0)
        strategy = strategy_signal.get("strategy", "unknown")
        direction = strategy_signal.get("direction", "long")
        signal_strength = strategy_signal.get("strength", 0.0)

        # ---- 1. Signal quality score (0-1) ---------------------------------
        signal_quality = self._compute_signal_quality(
            symbol, strategy, signal_strength, ta_summary
        )

        # ---- 2. Mood-based filters ------------------------------------------
        mood_effects = self.get_mood_effects()
        min_quality = mood_effects["min_signal_quality"]

        if signal_quality < min_quality:
            self._current_analysis = {
                "action": "skip",
                "symbol": symbol,
                "price": price,
                "signal_quality": round(signal_quality, 3),
                "reason": f"Signal quality ({signal_quality:.2f}) below mood threshold "
                          f"({min_quality:.2f}) for mood '{self.mood}'",
                "mood": self.mood,
                "stress": round(self.stress, 3),
                "reasoning": self._generate_reasoning(
                    "skip", symbol, price, strategy_signal, ta_summary
                ),
                "timestamp": time.time(),
            }
            return self._current_analysis

        # ---- 3. Position sizing ---------------------------------------------
        base_size = self._calculate_base_position_size(symbol, strategy, signal_quality)
        size_mult = mood_effects["position_size_multiplier"]
        position_size = base_size * size_mult

        # Stress-based size reduction
        if self.stress > self.config["stress_threshold"]:
            stress_factor = 1.0 - (self.stress - self.config["stress_threshold"]) / (
                self.config["max_stress"] - self.config["stress_threshold"]
            )
            position_size *= max(0.1, stress_factor)

        # Cap greedy oversizing
        if self.mood == "greedy":
            position_size = min(position_size, 1.2)

        # ---- 4. Decision timeline -------------------------------------------
        timeline = self.get_decision_timeline(signal_quality)

        # ---- 5. Risk / reward check -----------------------------------------
        entry = strategy_signal.get("entry", price)
        stop = strategy_signal.get("stop", entry * 0.99)
        target = strategy_signal.get("target", entry * 1.01)
        risk = abs(entry - stop)
        reward = abs(target - entry)
        rr_ratio = reward / risk if risk > 0 else 0.0

        # ---- 6. Build analysis result ----------------------------------------
        analysis = {
            "action": "trade" if timeline != "skip" else "skip",
            "symbol": symbol,
            "price": price,
            "direction": direction,
            "strategy": strategy,
            "signal_quality": round(signal_quality, 3),
            "position_size": round(position_size, 3),
            "timeline": timeline,
            "risk_reward": round(rr_ratio, 2),
            "mood": self.mood,
            "stress": round(self.stress, 3),
            "entry": entry,
            "stop": stop,
            "target": target,
            "reasoning": self._generate_reasoning(
                "trade" if timeline != "skip" else "skip",
                symbol, price, strategy_signal, ta_summary,
                extras={"signal_quality": signal_quality, "rr_ratio": rr_ratio}
            ),
            "timestamp": time.time(),
        }

        self._current_opportunity = {
            "coin_data": coin_data,
            "strategy_signal": strategy_signal,
            "ta_summary": ta_summary,
        }
        self._current_analysis = analysis
        return analysis

    def _compute_signal_quality(
        self,
        symbol: str,
        strategy: str,
        signal_strength: float,
        ta_summary: dict,
    ) -> float:
        """
        Compute a composite signal-quality score (0-1) blending:
        - raw signal strength
        - strategy confidence (from learning loop)
        - coin rating (personal history with this coin)
        - market-context fit
        - TA confluence
        """
        # Base from the strategy engine
        quality = signal_strength * 0.35

        # Strategy confidence (learning loop)
        strat_conf = self.get_strategy_confidence(strategy)
        quality += strat_conf * 0.20

        # Coin rating (personal memory)
        coin_rating = self.get_coin_rating(symbol)
        quality += coin_rating * 0.15

        # Market-context alignment
        context_fit = self._market_context_fit(strategy)
        quality += context_fit * 0.15

        # TA confluence
        ta_score = self._ta_confluence_score(ta_summary, strategy)
        quality += ta_score * 0.15

        # Momentum bias adjustment
        trend = ta_summary.get("trend", "sideways")
        if trend == "up" and strategy in ("trend_following", "breakout"):
            quality += self.config["momentum_bias"] * 0.05
        elif trend == "down" and strategy in ("mean_reversion", "vwap_scalp"):
            quality += self.config["momentum_bias"] * 0.03

        return max(0.0, min(1.0, quality))

    def _market_context_fit(self, strategy: str) -> float:
        """Return 0-1 score for how well *strategy* fits the current market context."""
        fits = {
            "trending":   {"trend_following": 1.0, "breakout": 0.8,
                           "vwap_scalp": 0.5, "mean_reversion": 0.2},
            "ranging":    {"mean_reversion": 1.0, "vwap_scalp": 0.8,
                           "breakout": 0.3, "trend_following": 0.2},
            "volatile":   {"breakout": 1.0, "vwap_scalp": 0.7,
                           "mean_reversion": 0.5, "trend_following": 0.4},
            "neutral":    {"vwap_scalp": 0.6, "mean_reversion": 0.5,
                           "trend_following": 0.5, "breakout": 0.5},
        }
        return fits.get(self.market_context, {}).get(strategy, 0.5)

    @staticmethod
    def _ta_confluence_score(ta_summary: dict, strategy: str) -> float:
        """
        Score technical-indicator alignment for *strategy*.
        Returns 0-1.
        """
        score = 0.5   # neutral base
        rsi = ta_summary.get("rsi", 50.0)
        vol = ta_summary.get("volume_ratio", 1.0)
        trend = ta_summary.get("trend", "sideways")

        if strategy == "mean_reversion":
            # Want oversold/overbought + declining volume
            if rsi < 30 or rsi > 70:
                score += 0.25
            if vol < 1.2:
                score += 0.15   # calmer = better for mean reversion
            if trend == "sideways":
                score += 0.10

        elif strategy == "trend_following":
            # Want trending RSI + volume confirmation
            if (rsi > 55 and trend == "up") or (rsi < 45 and trend == "down"):
                score += 0.25
            if vol > 1.3:
                score += 0.20

        elif strategy == "breakout":
            # Want high volume + RSI moving into trend
            if vol > 1.5:
                score += 0.30
            if trend in ("up", "down"):
                score += 0.15

        elif strategy == "vwap_scalp":
            # Want moderate volume + price near VWAP
            if 0.8 < vol < 2.0:
                score += 0.20
            if 40 < rsi < 60:
                score += 0.15   # balanced market

        return max(0.0, min(1.0, score))

    def _calculate_base_position_size(
        self, symbol: str, strategy: str, signal_quality: float
    ) -> float:
        """
        Calculate the base position size (as a fraction of max risk)
        before mood/stress multipliers.
        """
        risk_tol = self.config["risk_tolerance"]

        # Signal quality scaling — better signals = more size
        quality_factor = 0.5 + signal_quality * 0.5   # 0.5 - 1.0

        # Strategy preference
        strat_pref = self.config["strategy_preferences"].get(strategy, 0.5)
        strat_factor = 0.5 + strat_pref * 0.5          # 0.5 - 1.0

        # Coin rating
        coin_rating = self.get_coin_rating(symbol)
        coin_factor = 0.5 + coin_rating * 0.5          # 0.5 - 1.0

        base = risk_tol * quality_factor * strat_factor * coin_factor
        return round(min(base, 1.0), 3)

    # ------------------------------------------------------------------
    # Final Decision
    # ------------------------------------------------------------------

    def make_decision(self) -> dict:
        """
        Produce the final trade decision with full reasoning.

        Returns a dict with ``action`` ("trade" / "skip" / "wait"),
        complete sizing, and a ``narrative`` field containing
        Alex's human-like internal monologue.
        """
        if self._current_analysis is None:
            return {
                "action": "wait",
                "reason": "No opportunity has been analysed yet.",
                "narrative": "Haven't seen a setup worth evaluating yet. Scanning...",
                "timestamp": time.time(),
            }

        analysis = self._current_analysis.copy()

        # Override action based on final sanity checks
        if analysis["action"] == "trade":
            # Final FOMO resistance check
            if self._is_fomo_trade(analysis):
                analysis["action"] = "skip"
                analysis["reason"] = "FOMO filter triggered — avoiding emotional chase."
                analysis["narrative"] = (
                    f"{analysis['symbol']} is moving but I already missed the optimal entry. "
                    "Chasing here is FOMO — I'll wait for the next setup."
                )
                self.update_stress("missed_opportunity")
                self._last_decision = analysis
                return analysis

            # Build the full trade decision
            narrative = self._build_trade_narrative(analysis)
            analysis["narrative"] = narrative

        else:
            # Skip narrative
            analysis["narrative"] = analysis.get("reasoning", "No trade this cycle.")

        self._last_decision = analysis
        return analysis

    def _is_fomo_trade(self, analysis: dict) -> bool:
        """
        Detect if this trade is driven by FOMO rather than a valid setup.
        """
        # High signal quality + low patience = potential FOMO
        if analysis["signal_quality"] < 0.65:
            return False   # low quality — probably not FOMO, just a bad setup

        fomo_resistance = self.config["fomo_resistance"]

        # If Alex is greedy and the signal is mediocre, it might be FOMO
        if self.mood == "greedy" and analysis["signal_quality"] < 0.75:
            return random.random() > fomo_resistance

        # If price has already moved significantly from entry
        price = analysis.get("price", 0)
        entry = analysis.get("entry", price)
        if price > 0 and entry > 0:
            move_pct = abs(price - entry) / entry
            if move_pct > 0.005:   # > 0.5% from ideal entry
                return random.random() > fomo_resistance

        return False

    # ------------------------------------------------------------------
    # Natural-Language Reasoning Generation
    # ------------------------------------------------------------------

    def _generate_reasoning(
        self,
        action: str,
        symbol: str,
        price: float,
        strategy_signal: dict,
        ta_summary: dict,
        extras: Optional[dict] = None,
    ) -> str:
        """Generate a human-like reasoning string for a trade decision."""
        strategy = strategy_signal.get("strategy", "unknown")
        extras = extras or {}

        # Pick template bucket
        if action == "skip":
            templates = REASONING_TEMPLATES["skip"]
        elif strategy in REASONING_TEMPLATES:
            templates = REASONING_TEMPLATES[strategy]
        else:
            templates = ["Evaluating {symbol} at ${price:,.2f}..."]

        template = random.choice(templates)

        # Compute deviation from VWAP if available
        vwap = ta_summary.get("vwap", price)
        deviation = ((price - vwap) / vwap * 100) if vwap > 0 else 0.0

        # Duration for breakout template
        duration = ta_summary.get("consolidation_hours", random.randint(2, 8))

        # Level name for breakout
        level = "key" if random.random() > 0.5 else "major"

        rsi = ta_summary.get("rsi", 50.0)
        volume = ta_summary.get("volume_ratio", 1.0)
        atr = ta_summary.get("atr", price * 0.002)
        stop_size = abs(strategy_signal.get("stop", price) - price) / atr if atr > 0 else 1.0

        try:
            reasoning = template.format(
                symbol=symbol,
                price=price,
                rsi=rsi,
                volume=f"{volume:.1f}",
                deviation=abs(deviation),
                duration=duration,
                level=level,
                stop_size=max(1.0, stop_size),
            )
        except (KeyError, ValueError):
            reasoning = f"{'Taking' if action == 'trade' else 'Skipping'} {symbol} at ${price:,.2f} — {strategy} signal."

        # Append mood context for flavour
        if self.mood == "sharp":
            reasoning += " Feeling sharp — execution mode."
        elif self.mood == "cautious":
            reasoning += " Being extra selective after recent losses."
        elif self.mood == "confident":
            reasoning += " Running hot — consistent wins building flow."

        return reasoning

    def _build_trade_narrative(self, analysis: dict) -> str:
        """
        Build a rich, human-like narrative for a confirmed trade decision,
        combining the reasoning with Alex's emotional state and risk assessment.
        """
        parts = []
        parts.append(analysis.get("reasoning", ""))

        # Risk assessment
        parts.append(
            f"Risk/reward is {analysis['risk_reward']:.1f}:1 — "
            f"stop at ${analysis['stop']:,.2f}, target ${analysis['target']:,.2f}."
        )

        # Sizing info
        if analysis["position_size"] < 0.5:
            parts.append(
                f"Sizing down to {int(analysis['position_size'] * 100)}% — "
                f"{self.mood} mode."
            )
        elif analysis["position_size"] > 1.0:
            parts.append(
                f"Slight sizing up to {int(analysis['position_size'] * 100)}% — "
                f"feeling good about this one."
            )

        # Timeline urgency
        if analysis["timeline"] == "immediate":
            parts.append("A+ setup — executing now.")
        elif analysis["timeline"] == "fast":
            parts.append("Good setup — moving quickly.")

        # Stress check
        if self.stress > 0.5:
            parts.append(f"Stress at {int(self.stress * 100)}% — managing it, staying disciplined.")

        return " ".join(parts)

    # ------------------------------------------------------------------
    # Learning Loop — Record Trade Results
    # ------------------------------------------------------------------

    def record_trade_result(self, trade_result: dict) -> None:
        """
        Learn from a completed trade.

        Parameters
        ----------
        trade_result : dict
            Required keys: ``symbol``, ``strategy``, ``result`` ("win"/"loss"),
            ``pnl`` (float, percent).
            Optional:  ``entry_price``, ``exit_price``, ``duration_seconds``.
        """
        symbol = trade_result.get("symbol", "UNKNOWN")
        strategy = trade_result.get("strategy", "unknown")
        result = trade_result.get("result", "loss")
        pnl = trade_result.get("pnl", 0.0)

        # ---- update emotional state -----------------------------------------
        self.update_stress("win" if result == "win" else "loss")

        # ---- update session stats -------------------------------------------
        stats = self.config["session_stats"]
        stats["trades_today"] += 1
        stats["pnl_today"] += pnl
        stats["last_trade_time"] = time.time()
        if result == "win":
            stats["wins_today"] += 1
        else:
            stats["losses_today"] += 1

        # ---- update strategy performance ------------------------------------
        self._update_strategy_performance(strategy, result, pnl)

        # ---- update coin memory ---------------------------------------------
        self._update_coin_rating(symbol, result, pnl)

        # ---- generate post-trade reasoning ----------------------------------
        narrative_bucket = f"post_{result}" if result in ("win", "loss") else "post_loss"
        templates = REASONING_TEMPLATES.get(narrative_bucket, ["Trade closed."])
        post_reasoning = random.choice(templates).format(
            symbol=symbol, pnl=pnl
        )

        # Enrich and store the full result record
        trade_result["post_reasoning"] = post_reasoning
        trade_result["stress_after"] = round(self.stress, 3)
        trade_result["mood_after"] = self.mood
        trade_result.setdefault("timestamp", time.time())

        # ---- append to rolling history --------------------------------------
        self.trade_history.append(trade_result)
        if len(self.trade_history) > self.max_history:
            self.trade_history = self.trade_history[-self.max_history:]

        # Persist state
        self._save_state()

    # ------------------------------------------------------------------
    # Status & Introspection
    # ------------------------------------------------------------------

    def get_status(self) -> dict:
        """
        Return Alex's current internal state: mood, stress, confidence per
        strategy, coin ratings, session stats, and market context.
        """
        return {
            "name": self.config["name"],
            "mood": self.mood,
            "mood_since": datetime.fromtimestamp(self.mood_since).isoformat(),
            "stress": round(self.stress, 3),
            "market_context": self.market_context,
            "consecutive_wins": self._consecutive_wins,
            "consecutive_losses": self._consecutive_losses,
            "analysis_cycles": self._analysis_cycles,
            "strategy_confidence": {
                s: round(d["confidence"], 3)
                for s, d in self.strategy_performance.items()
            },
            "coin_ratings": dict(self.config.get("coin_ratings", {})),
            "session_stats": dict(self.config["session_stats"]),
            "mood_effects": self.get_mood_effects(),
            "can_trade": self.should_trade_now(),
            "current_opportunity": self._current_analysis is not None,
        }

    def get_strategy_summary(self) -> dict:
        """Return detailed performance summary for each strategy."""
        summary = {}
        for strat, perf in self.strategy_performance.items():
            total = perf["wins"] + perf["losses"]
            summary[strat] = {
                "wins": perf["wins"],
                "losses": perf["losses"],
                "total": total,
                "win_rate": round(perf["wins"] / total, 3) if total > 0 else 0.0,
                "pnl": round(perf["pnl"], 4),
                "confidence": round(perf["confidence"], 3),
            }
        return summary

    def get_coin_report(self) -> dict:
        """Return a sorted report of coin ratings."""
        ratings = self.config.get("coin_ratings", {})
        return dict(sorted(ratings.items(), key=lambda x: x[1], reverse=True))

    # ------------------------------------------------------------------
    # Persistence — JSON Save / Load
    # ------------------------------------------------------------------

    def _save_state(self) -> None:
        """Persist Alex's state to ``alex_state.json``."""
        state = {
            "config": self.config,
            "stress": self.stress,
            "mood": self.mood,
            "mood_since": self.mood_since,
            "consecutive_wins": self._consecutive_wins,
            "consecutive_losses": self._consecutive_losses,
            "analysis_cycles": self._analysis_cycles,
            "strategy_performance": self.strategy_performance,
            "trade_history": self.trade_history[-self.max_history:],
            "market_context": self.market_context,
            "saved_at": time.time(),
        }
        try:
            self.state_file.write_text(json.dumps(state, indent=2, default=str))
        except OSError:
            pass   # best-effort persistence

    def _load_state(self) -> None:
        """Restore Alex's state from ``alex_state.json`` if it exists."""
        if not self.state_file.exists():
            return
        try:
            state = json.loads(self.state_file.read_text())
            self.stress = state.get("stress", 0.0)
            self.mood = state.get("mood", "neutral")
            self.mood_since = state.get("mood_since", time.time())
            self._consecutive_wins = state.get("consecutive_wins", 0)
            self._consecutive_losses = state.get("consecutive_losses", 0)
            self._analysis_cycles = state.get("analysis_cycles", 0)
            self.strategy_performance = state.get(
                "strategy_performance", self.strategy_performance
            )
            self.trade_history = state.get("trade_history", [])
            self.market_context = state.get("market_context", "neutral")
            # Config is already merged in __init__; restore coin_ratings & stats
            saved_config = state.get("config", {})
            if "coin_ratings" in saved_config:
                self.config["coin_ratings"] = saved_config["coin_ratings"]
            if "session_stats" in saved_config:
                self.config["session_stats"] = saved_config["session_stats"]
            if "strategy_preferences" in saved_config:
                self.config["strategy_preferences"] = saved_config["strategy_preferences"]
        except (json.JSONDecodeError, KeyError, TypeError):
            pass   # corrupted state — start fresh

    # ------------------------------------------------------------------
    # Reset Helpers
    # ------------------------------------------------------------------

    def reset_session(self) -> None:
        """Reset today's session stats (call at start of new trading day)."""
        self.config["session_stats"] = {
            "trades_today": 0,
            "wins_today": 0,
            "losses_today": 0,
            "pnl_today": 0.0,
            "last_trade_time": None,
        }
        self._consecutive_wins = 0
        self._consecutive_losses = 0
        self._save_state()

    def full_reset(self) -> None:
        """Wipe all state and start Alex from scratch."""
        self.stress = 0.0
        self.mood = "neutral"
        self._consecutive_wins = 0
        self._consecutive_losses = 0
        self._analysis_cycles = 0
        self._frustration_cooldown_until = 0.0
        self._current_opportunity = None
        self._current_analysis = None
        self._last_decision = None
        self.strategy_performance = {
            "mean_reversion":   {"wins": 0, "losses": 0, "pnl": 0.0, "confidence": 0.5},
            "trend_following":  {"wins": 0, "losses": 0, "pnl": 0.0, "confidence": 0.5},
            "breakout":         {"wins": 0, "losses": 0, "pnl": 0.0, "confidence": 0.5},
            "vwap_scalp":       {"wins": 0, "losses": 0, "pnl": 0.0, "confidence": 0.5},
        }
        self.config["coin_ratings"] = {}
        self.config["session_stats"] = {
            "trades_today": 0,
            "wins_today": 0,
            "losses_today": 0,
            "pnl_today": 0.0,
            "last_trade_time": None,
        }
        self.trade_history = []
        if self.state_file.exists():
            self.state_file.unlink()

    def __repr__(self) -> str:
        return (
            f"AlexBrain(mood={self.mood!r}, stress={self.stress:.2f}, "
            f"trades_today={self.config['session_stats']['trades_today']}, "
            f"can_trade={self.should_trade_now()})"
        )


# =============================================================================
# Example / Self-Test
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("  Alex V2 — Enhanced Personality & Orchestrator Engine")
    print("  Self-Test Demo")
    print("=" * 70)

    # ------------------------------------------------------------------
    # 1. Create Alex
    # ------------------------------------------------------------------
    print("\n--- 1. Initialising Alex ---")
    alex = AlexBrain()
    print(f"Alex created: {alex}")
    print(f"Status: {json.dumps(alex.get_status(), indent=2)}")

    # ------------------------------------------------------------------
    # 2. Simulate a trending market
    # ------------------------------------------------------------------
    print("\n--- 2. Setting market context: TRENDING ---")
    alex.set_market_context("trending")
    print(f"Market context: {alex.market_context}")

    # ------------------------------------------------------------------
    # 3. Analyse an A+ breakout opportunity
    # ------------------------------------------------------------------
    print("\n--- 3. Analysing A+ Breakout Setup (BTC) ---")
    coin_data = {"symbol": "BTCUSDT", "price": 43200.50}
    strategy_signal = {
        "strategy": "breakout",
        "direction": "long",
        "strength": 0.92,
        "entry": 43200.50,
        "stop": 43000.00,
        "target": 43600.00,
    }
    ta_summary = {
        "rsi": 62.0,
        "volume_ratio": 2.4,
        "atr": 180.0,
        "trend": "up",
        "support": 42800.0,
        "resistance": 43200.0,
        "vwap": 43050.0,
        "consolidation_hours": 4,
    }

    analysis = alex.analyze_opportunity(coin_data, strategy_signal, ta_summary)
    print(f"Signal quality: {analysis['signal_quality']}")
    print(f"Timeline: {analysis['timeline']}")
    print(f"Position size: {analysis['position_size']}")
    print(f"Reasoning: {analysis['reasoning']}")

    decision = alex.make_decision()
    print(f"\nDECISION: {decision['action'].upper()}")
    print(f"Narrative: {decision['narrative']}")

    # ------------------------------------------------------------------
    # 4. Record a WIN — Alex feels good
    # ------------------------------------------------------------------
    print("\n--- 4. Recording a WIN ---")
    alex.record_trade_result({
        "symbol": "BTCUSDT",
        "strategy": "breakout",
        "result": "win",
        "pnl": 0.85,
        "entry_price": 43200.50,
        "exit_price": 43560.00,
    })
    print(f"After win: mood={alex.mood}, stress={alex.stress:.2f}")
    print(f"Post-reasoning: {alex.trade_history[-1]['post_reasoning']}")

    # ------------------------------------------------------------------
    # 5. Analyse a mean-reversion opportunity
    # ------------------------------------------------------------------
    print("\n--- 5. Analysing Mean-Reversion Setup (ETH) ---")
    coin_data_eth = {"symbol": "ETHUSDT", "price": 2280.00}
    strategy_signal_eth = {
        "strategy": "mean_reversion",
        "direction": "long",
        "strength": 0.78,
        "entry": 2280.00,
        "stop": 2265.00,
        "target": 2305.00,
    }
    ta_summary_eth = {
        "rsi": 26.0,
        "volume_ratio": 0.9,
        "atr": 12.5,
        "trend": "sideways",
        "support": 2275.00,
        "resistance": 2320.00,
        "vwap": 2295.00,
    }

    analysis_eth = alex.analyze_opportunity(coin_data_eth, strategy_signal_eth, ta_summary_eth)
    print(f"Signal quality: {analysis_eth['signal_quality']}")
    print(f"Reasoning: {analysis_eth['reasoning']}")
    decision_eth = alex.make_decision()
    print(f"DECISION: {decision_eth['action'].upper()}")

    # Record another win
    alex.record_trade_result({
        "symbol": "ETHUSDT",
        "strategy": "mean_reversion",
        "result": "win",
        "pnl": 0.62,
    })
    print(f"After 2nd win: mood={alex.mood}, stress={alex.stress:.2f}")

    # ------------------------------------------------------------------
    # 6. Simulate a LOSS — stress increases
    # ------------------------------------------------------------------
    print("\n--- 6. Recording a LOSS ---")
    alex.record_trade_result({
        "symbol": "SOLUSDT",
        "strategy": "breakout",
        "result": "loss",
        "pnl": -0.45,
    })
    print(f"After loss: mood={alex.mood}, stress={alex.stress:.2f}")
    print(f"Post-reasoning: {alex.trade_history[-1]['post_reasoning']}")

    # ------------------------------------------------------------------
    # 7. Simulate consecutive losses → CAUTIOUS / FEARFUL
    # ------------------------------------------------------------------
    print("\n--- 7. Simulating Consecutive Losses ---")
    for i in range(3):
        alex.record_trade_result({
            "symbol": "DOGEUSDT",
            "strategy": "vwap_scalp",
            "result": "loss",
            "pnl": -0.30 - i * 0.1,
        })
        print(f"  Loss {i+1}: mood={alex.mood}, stress={alex.stress:.2f}")

    print(f"\nCurrent status:\n{json.dumps(alex.get_status(), indent=2)}")

    # ------------------------------------------------------------------
    # 8. Stress recovery via natural decay (simulated cycles)
    # ------------------------------------------------------------------
    print("\n--- 8. Stress Recovery via Natural Decay ---")
    print(f"Stress before decay cycles: {alex.stress:.2f}")
    for i in range(5):
        alex.update_stress("cycle")
        print(f"  Cycle {i+1}: stress={alex.stress:.2f}, mood={alex.mood}")

    # ------------------------------------------------------------------
    # 9. Check strategy performance summary
    # ------------------------------------------------------------------
    print("\n--- 9. Strategy Performance Summary ---")
    print(json.dumps(alex.get_strategy_summary(), indent=2))

    # ------------------------------------------------------------------
    # 10. Check coin ratings
    # ------------------------------------------------------------------
    print("\n--- 10. Coin Ratings ---")
    print(json.dumps(alex.get_coin_report(), indent=2))

    # ------------------------------------------------------------------
    # 11. should_trade_now filter
    # ------------------------------------------------------------------
    print("\n--- 11. Should Trade Now? ---")
    print(f"can_trade = {alex.should_trade_now()}")

    # ------------------------------------------------------------------
    # 12. Decision speed demo
    # ------------------------------------------------------------------
    print("\n--- 12. Decision Speed System ---")
    for quality in [0.92, 0.78, 0.62, 0.45]:
        speed = alex.get_decision_timeline(quality)
        print(f"  Signal quality {quality:.2f} -> {speed}")

    # ------------------------------------------------------------------
    # 13. Full status dump
    # ------------------------------------------------------------------
    print("\n--- 13. Final Status ---")
    print(json.dumps(alex.get_status(), indent=2))

    print("\n" + "=" * 70)
    print("  Demo complete. Alex V2 is ready to trade.")
    print("=" * 70)
