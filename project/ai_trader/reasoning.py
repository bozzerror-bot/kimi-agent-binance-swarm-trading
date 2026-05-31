import random
from typing import Dict, List, Optional
from datetime import datetime


class ReasoningEngine:
    """Human-like reasoning engine that analyzes markets and makes trade decisions."""

    def __init__(self, personality, memory, model: str = "default"):
        self.personality = personality
        self.memory = memory
        self.model = model

    async def analyze(self, market_data: dict, indicators: dict, balance: dict) -> dict:
        """
        Analyze market conditions and make a trading decision.
        Returns a dict with full reasoning and decision.
        """
        symbol = market_data.get("symbol", "UNKNOWN")
        price = market_data.get("price", 0)
        change_24h = market_data.get("change_24h", 0)

        rsi = indicators.get("rsi", 50)
        macd = indicators.get("macd", 0)
        macd_signal = indicators.get("macd_signal", 0)
        bb_position = indicators.get("bb_position", 0.5)
        trend = indicators.get("trend", "neutral")
        volume_ratio = indicators.get("volume_ratio", 1.0)
        support = indicators.get("support", price * 0.95)
        resistance = indicators.get("resistance", price * 1.05)

        # Get memory context
        memory_context = self.memory.to_context()
        mood_desc = self.personality.get_mood_description()

        # Score generation (like a human weighing factors)
        buy_score = 0.0
        sell_score = 0.0
        reasons = []
        risks = []

        # RSI Analysis
        if rsi < 30:
            buy_score += 30
            reasons.append(f"RSI is oversold at {rsi:.1f} — potential bounce zone")
        elif rsi < 40:
            buy_score += 15
            reasons.append(f"RSI at {rsi:.1f} — approaching oversold, could be entry")
        elif rsi > 70:
            sell_score += 30
            reasons.append(f"RSI is overbought at {rsi:.1f} — overheated")
        elif rsi > 60:
            sell_score += 15
            reasons.append(f"RSI at {rsi:.1f} — getting warm, caution warranted")
        else:
            reasons.append(f"RSI at {rsi:.1f} — neutral territory")

        # MACD Analysis
        if macd > macd_signal and macd > 0:
            buy_score += 25
            reasons.append(f"MACD ({macd:.2f}) above signal — bullish momentum")
        elif macd < macd_signal and macd < 0:
            sell_score += 25
            reasons.append(f"MACD ({macd:.2f}) below signal — bearish momentum")
        elif macd > macd_signal:
            buy_score += 10
            reasons.append(f"MACD crossing above signal — possible early bullish")
        else:
            sell_score += 10
            reasons.append(f"MACD below signal — bearish crossover")

        # Bollinger Bands Position
        if bb_position < 0.1:
            buy_score += 20
            reasons.append("Price at lower Bollinger Band — potential support bounce")
        elif bb_position > 0.9:
            sell_score += 20
            reasons.append("Price at upper Bollinger Band — resistance zone")
        elif bb_position < 0.3:
            buy_score += 10
            reasons.append("Price in lower half of BB — leaning bullish")
        elif bb_position > 0.7:
            sell_score += 10
            reasons.append("Price in upper half of BB — leaning bearish")

        # Trend Analysis
        if trend == "bullish":
            buy_score += 20
            reasons.append("Overall trend is bullish — riding the wave")
        elif trend == "bearish":
            sell_score += 20
            reasons.append("Overall trend is bearish — don't fight it")

        # Volume Analysis
        if volume_ratio > 1.5:
            if buy_score > sell_score:
                buy_score += 15
                reasons.append(f"Strong volume ({volume_ratio:.1f}x avg) confirms bullish bias")
            elif sell_score > buy_score:
                sell_score += 15
                reasons.append(f"Strong volume ({volume_ratio:.1f}x avg) confirms bearish bias")
        elif volume_ratio < 0.5:
            risks.append("Low volume — moves might not be trustworthy")

        # Support/Resistance proximity
        dist_to_support = (price - support) / price * 100
        dist_to_resistance = (resistance - price) / price * 100

        if dist_to_support < 1.0:
            buy_score += 15
            reasons.append(f"Only {dist_to_support:.1f}% above support — good risk/reward")
        if dist_to_resistance < 1.0:
            sell_score += 15
            reasons.append(f"Only {dist_to_resistance:.1f}% below resistance — take profits?")

        # Personality and memory influence
        if self.personality.mood in ["fearful", "hesitant"]:
            risks.append(f"Feeling {self.personality.mood} — might miss good setups or panic")
        if self.personality.stress_level > 0.5:
            risks.append("High stress level — considering sitting this one out")

        # Memory influence
        stats = self.memory.get_statistics()
        if stats["total_trades"] > 5 and stats["win_rate"] < 40:
            risks.append(f"Recent win rate is low ({stats['win_rate']:.0f}%) — need to be selective")

        # Apply personality modifier
        raw_signal = (buy_score - sell_score + 100) / 200  # Normalize to 0-1
        modified_signal = self.personality.affects_decision(raw_signal)

        # Decision
        confidence = abs(modified_signal - 0.5) * 2  # 0 = unsure, 1 = very confident

        # Apply patience filter
        if self.personality.patience > 0.7 and confidence < 0.5:
            decision = "HOLD"
            thought = self._generate_thought(
                symbol, price, mood_desc, reasons, risks,
                "Patience filter: setup isn't strong enough to act", modified_signal
            )
        elif modified_signal > 0.55 and confidence > 0.3:
            decision = "BUY"
            thought = self._generate_thought(
                symbol, price, mood_desc, reasons, risks,
                f"Bullish signals outweigh bearish ({buy_score:.0f} vs {sell_score:.0f})", modified_signal
            )
        elif modified_signal < 0.45 and confidence > 0.3:
            decision = "SELL"
            thought = self._generate_thought(
                symbol, price, mood_desc, reasons, risks,
                f"Bearish signals outweigh bullish ({sell_score:.0f} vs {buy_score:.0f})", modified_signal
            )
        else:
            decision = "HOLD"
            thought = self._generate_thought(
                symbol, price, mood_desc, reasons, risks,
                "Signals are mixed — better to wait for clarity", modified_signal
            )

        # Calculate position size based on confidence and risk tolerance
        size = 0.0
        stop_loss = None
        take_profit = None

        if decision in ["BUY", "SELL"]:
            base_size = self.personality.risk_tolerance * 0.2  # Max 20% per trade
            confidence_multiplier = confidence * self.personality.confidence_level
            size = min(base_size * confidence_multiplier * 2, 0.2)  # Cap at 20%
            size = round(size, 4)

            if size < 0.02:  # Minimum 2% position
                decision = "HOLD"
                thought += "\n\nActually, position size would be too small. Passing."
            else:
                # Set stop loss and take profit
                if decision == "BUY":
                    stop_loss = round(price * 0.97, 2)  # 3% stop
                    take_profit = round(price * 1.05, 2)  # 5% target
                else:
                    stop_loss = round(price * 1.03, 2)
                    take_profit = round(price * 0.95, 2)

        return {
            "thought_process": thought,
            "decision": decision,
            "confidence": round(confidence, 2),
            "size": size,
            "reasons": reasons,
            "risks": risks,
            "entry_price": price if decision in ["BUY", "SELL"] else None,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "raw_scores": {"buy": buy_score, "sell": sell_score, "signal": modified_signal},
        }

    def _generate_thought(self, symbol, price, mood, reasons, risks, conclusion, signal) -> str:
        """Generate human-like thought process."""
        lines = [
            f"Looking at {symbol} at ${price:,.2f}...",
            "",
            f"My gut check: {mood}",
            "",
            "Here's what I'm seeing:",
        ]
        for r in reasons[:5]:
            lines.append(f"  • {r}")

        if risks:
            lines.extend(["", "But I'm also worried about:"])
            for r in risks[:3]:
                lines.append(f"  ⚠ {r}")

        lines.extend([
            "",
            f"Signal strength: {signal:.2f} (0=bearish, 1=bullish)",
            "",
            f"Decision: {conclusion}",
        ])

        # Add personality-specific flavor
        flavor = random.choice([
            "Let's see how this plays out.",
            "Trust the process.",
            "No FOMO, just logic.",
            "One trade at a time.",
            "Discipline over emotion.",
        ])
        lines.append(f"\n{flavor}")

        return "\n".join(lines)
