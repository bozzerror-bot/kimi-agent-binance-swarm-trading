#!/usr/bin/env python3
"""
Live Mock Trading Simulator for AI Trader.
Simulates realistic crypto markets and runs Alex through full trading cycles.
Outputs live-state.json for the dashboard to consume.
"""

import asyncio
import json
import random
import math
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass, field, asdict

from config import CONFIG
from personality import Personality
from memory import MemoryAgent
from reasoning import ReasoningEngine
from risk_guardian import RiskGuardian


@dataclass
class SimulatedPosition:
    symbol: str
    side: str  # "BUY" or "SELL"
    entry_price: float
    size: float  # quantity in base asset
    value: float  # USDT value at entry
    stop_loss: float
    take_profit: float
    entry_time: str
    mood_at_entry: str
    rsi_at_entry: float
    trend_at_entry: str
    reasoning: str


@dataclass
class MarketState:
    symbol: str
    price: float
    change_24h: float
    rsi: float
    macd: float
    macd_signal: float
    macd_hist: float
    bb_position: float
    ema_20: float
    ema_50: float
    trend: str
    volume_ratio: float
    support: float
    resistance: float
    price_history: List[float] = field(default_factory=list)


class MarketSimulator:
    """Simulates realistic crypto price movements using geometric Brownian motion."""

    def __init__(self):
        self.btc_state = self._init_market("BTCUSDT", 43250.0, 2.4)
        self.eth_state = self._init_market("ETHUSDT", 2780.0, 1.8)
        self.volatility = {
            "BTCUSDT": 0.0015,  # ~0.15% per tick
            "ETHUSDT": 0.0020,  # ~0.20% per tick (more volatile)
        }
        self.tick_count = 0

    def _init_market(self, symbol: str, price: float, change_24h: float) -> MarketState:
        # Generate realistic price history
        history = []
        current = price / (1 + change_24h / 100)
        for i in range(100):
            drift = (price - current) / (100 - i) if i < 100 else 0
            noise = random.gauss(0, price * 0.008)
            current = current + drift + noise
            history.append(max(current, price * 0.5))
        history[-1] = price  # Ensure current price matches

        indicators = self._calculate_indicators(history)
        return MarketState(
            symbol=symbol,
            price=price,
            change_24h=change_24h,
            rsi=indicators["rsi"],
            macd=indicators["macd"],
            macd_signal=indicators["macd_signal"],
            macd_hist=indicators["macd_hist"],
            bb_position=indicators["bb_position"],
            ema_20=indicators["ema_20"],
            ema_50=indicators["ema_50"],
            trend=indicators["trend"],
            volume_ratio=random.uniform(0.6, 1.8),
            support=indicators["support"],
            resistance=indicators["resistance"],
            price_history=history,
        )

    def _calculate_indicators(self, prices: List[float]) -> dict:
        if len(prices) < 50:
            return {"rsi": 50, "macd": 0, "macd_signal": 0, "macd_hist": 0,
                    "bb_position": 0.5, "ema_20": prices[-1], "ema_50": prices[-1],
                    "trend": "neutral", "support": prices[-1] * 0.95, "resistance": prices[-1] * 1.05}

        # RSI (14-period)
        deltas = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
        gains = [d if d > 0 else 0 for d in deltas[-14:]]
        losses = [-d if d < 0 else 0 for d in deltas[-14:]]
        avg_gain = sum(gains) / len(gains) if gains else 0.01
        avg_loss = sum(losses) / len(losses) if losses else 0.01
        rs = avg_gain / avg_loss if avg_loss > 0 else 100
        rsi = 100 - (100 / (1 + rs))

        # EMAs
        ema_12 = self._ema(prices, 12)
        ema_26 = self._ema(prices, 26)
        ema_9 = self._ema(prices, 9)
        ema_20 = self._ema(prices, 20)
        ema_50 = self._ema(prices, 50)

        # MACD
        macd = ema_12 - ema_26
        macd_signal = ema_9 - self._ema(prices[:-8], 26) if len(prices) > 34 else macd * 0.8
        macd_hist = macd - macd_signal

        # Bollinger Bands
        sma_20 = sum(prices[-20:]) / 20
        std_20 = math.sqrt(sum((p - sma_20) ** 2 for p in prices[-20:]) / 20)
        bb_upper = sma_20 + 2 * std_20
        bb_lower = sma_20 - 2 * std_20
        bb_range = bb_upper - bb_lower if bb_upper != bb_lower else 1
        bb_position = (prices[-1] - bb_lower) / bb_range

        # Trend
        if ema_20 > ema_50 * 1.005:
            trend = "bullish"
        elif ema_20 < ema_50 * 0.995:
            trend = "bearish"
        else:
            trend = "neutral"

        # Support/Resistance
        recent = prices[-30:]
        support = min(recent)
        resistance = max(recent)

        return {
            "rsi": rsi,
            "macd": macd,
            "macd_signal": macd_signal,
            "macd_hist": macd_hist,
            "bb_position": max(0, min(1, bb_position)),
            "ema_20": ema_20,
            "ema_50": ema_50,
            "trend": trend,
            "support": support,
            "resistance": resistance,
        }

    def _ema(self, prices: List[float], period: int) -> float:
        if len(prices) < period:
            return prices[-1] if prices else 0
        multiplier = 2 / (period + 1)
        ema = sum(prices[:period]) / period
        for price in prices[period:]:
            ema = (price - ema) * multiplier + ema
        return ema

    def tick(self):
        """Advance one time tick - update prices with realistic movement."""
        self.tick_count += 1
        for state in [self.btc_state, self.eth_state]:
            vol = self.volatility.get(state.symbol, 0.001)
            # Mean reversion + random walk
            change_pct = random.gauss(0, vol)
            # Add occasional trend persistence
            if len(state.price_history) >= 2:
                last_change = (state.price_history[-1] - state.price_history[-2]) / state.price_history[-2]
                change_pct += last_change * 0.3  # 30% momentum
            # Mean reversion to EMA
            if state.ema_20 > 0:
                mean_reversion = (state.ema_20 - state.price) / state.price * 0.02
                change_pct += mean_reversion

            new_price = state.price * (1 + change_pct)
            new_price = max(new_price, state.price * 0.5)  # Floor
            state.price = round(new_price, 2)
            state.price_history.append(state.price)
            if len(state.price_history) > 200:
                state.price_history = state.price_history[-200:]

            # Recalculate indicators
            indicators = self._calculate_indicators(state.price_history)
            state.rsi = indicators["rsi"]
            state.macd = indicators["macd"]
            state.macd_signal = indicators["macd_signal"]
            state.macd_hist = indicators["macd_hist"]
            state.bb_position = indicators["bb_position"]
            state.ema_20 = indicators["ema_20"]
            state.ema_50 = indicators["ema_50"]
            state.trend = indicators["trend"]
            state.support = indicators["support"]
            state.resistance = indicators["resistance"]

            # Update 24h change
            if len(state.price_history) >= 96:  # ~24h of 15m ticks
                old_price = state.price_history[-96]
                state.change_24h = round((state.price - old_price) / old_price * 100, 2)

            # Update volume
            state.volume_ratio = round(random.uniform(0.5, 2.0), 2)

    def get_state(self, symbol: str) -> MarketState:
        if symbol == "BTCUSDT":
            return self.btc_state
        return self.eth_state


class TradingSimulator:
    """Runs the full AI trading simulation."""

    def __init__(self):
        self.personality = Personality(CONFIG["personality"])
        self.memory = MemoryAgent(CONFIG["memory_file"])
        self.reasoning = ReasoningEngine(self.personality, self.memory)
        self.risk = RiskGuardian(CONFIG["risk"])
        self.market = MarketSimulator()

        # Portfolio
        self.initial_balance = 10000.0
        self.total_balance = 10000.0
        self.usdt_available = 10000.0
        self.positions: List[SimulatedPosition] = []
        self.closed_trades: List[dict] = []

        # Load existing memory
        self._sync_from_memory()

        # Live state output
        self.live_state_file = "live-state.json"
        self.reasoning_log: List[dict] = []
        self.cycle_count = 0
        self.running = False

    def _sync_from_memory(self):
        """Sync portfolio state from memory."""
        stats = self.memory.get_statistics()
        if stats["total_trades"] > 0:
            # Rebuild state from trade history
            for trade in self.memory.trades:
                if trade["status"] == "open":
                    pos = SimulatedPosition(
                        symbol=trade["symbol"],
                        side=trade["side"],
                        entry_price=trade["entry_price"],
                        size=trade["size"],
                        value=trade["entry_price"] * trade["size"],
                        stop_loss=trade.get("stop_loss", trade["entry_price"] * 0.97),
                        take_profit=trade.get("take_profit", trade["entry_price"] * 1.05),
                        entry_time=trade["timestamp"],
                        mood_at_entry=trade.get("mood_at_entry", "neutral"),
                        rsi_at_entry=trade.get("rsi_at_entry", 50),
                        trend_at_entry=trade.get("trend_at_entry", "neutral"),
                        reasoning=trade.get("reasoning", ""),
                    )
                    self.positions.append(pos)
                    self.usdt_available -= pos.value

            # Rebuild closed trades
            for t in self.memory.trades:
                if t["status"] == "closed":
                    self.closed_trades.append(t)

    def _check_positions(self):
        """Check if any positions hit stop loss or take profit."""
        to_close = []
        for pos in self.positions:
            state = self.market.get_state(pos.symbol)
            if pos.side == "BUY":
                if state.price <= pos.stop_loss:
                    to_close.append((pos, "stop_loss", state.price))
                elif state.price >= pos.take_profit:
                    to_close.append((pos, "take_profit", state.price))
            else:  # SELL
                if state.price >= pos.stop_loss:
                    to_close.append((pos, "stop_loss", state.price))
                elif state.price <= pos.take_profit:
                    to_close.append((pos, "take_profit", state.price))

        for pos, reason, exit_price in to_close:
            self._close_position(pos, exit_price, reason)

    def _close_position(self, pos: SimulatedPosition, exit_price: float, reason: str):
        """Close a position and record P&L."""
        if pos.side == "BUY":
            pnl = (exit_price - pos.entry_price) * pos.size
        else:
            pnl = (pos.entry_price - exit_price) * pos.size

        # Subtract 0.1% trading fee
        fee = exit_price * pos.size * 0.001
        pnl -= fee

        pnl = round(pnl, 2)
        self.usdt_available += pos.value + pnl

        # Record in memory
        self.memory.record_trade({
            "symbol": pos.symbol,
            "side": pos.side,
            "entry_price": pos.entry_price,
            "exit_price": exit_price,
            "size": pos.size,
            "pnl": pnl,
            "pnl_pct": round(pnl / pos.value * 100, 1) if pos.value > 0 else 0,
            "status": "closed",
            "reasoning": f"{pos.reasoning} | Close reason: {reason}",
            "mood_at_entry": pos.mood_at_entry,
            "rsi_at_entry": pos.rsi_at_entry,
            "trend_at_entry": pos.trend_at_entry,
        })

        # Update personality
        self.personality.update_emotion({"pnl": pnl})

        # Add to closed trades
        self.closed_trades.append({
            "symbol": pos.symbol,
            "side": pos.side,
            "entry_price": pos.entry_price,
            "exit_price": exit_price,
            "size": pos.size,
            "pnl": pnl,
            "reason": reason,
            "time": datetime.utcnow().isoformat(),
        })

        # Remove from positions
        self.positions = [p for p in self.positions if p != pos]

        # Add reasoning log entry
        self.reasoning_log.insert(0, {
            "time": datetime.utcnow().strftime("%H:%M:%S"),
            "mood": self.personality.mood,
            "text": f"Closed {pos.side} {pos.symbol} @ ${exit_price:,.2f} ({reason}). P&L: ${pnl:+.2f}. Feeling {self.personality.mood} now.",
        })

        print(f"  📤 POSITION CLOSED: {pos.side} {pos.symbol} @ ${exit_price:,.2f} | P&L: ${pnl:+.2f} ({reason})")

    async def _run_cycle(self):
        """Run one trading cycle."""
        self.cycle_count += 1
        now = datetime.utcnow().strftime("%H:%M:%S")
        print(f"\n{'='*60}")
        print(f"  🔄 CYCLE #{self.cycle_count} | {now}")
        print(f"  😊 Mood: {self.personality.mood.upper()} | Stress: {self.personality.stress_level:.1f}")
        print(f"{'='*60}")

        # 1. Advance market
        self.market.tick()
        print(f"\n  📈 Market tick #{self.market.tick_count}")

        # 2. Check existing positions (stop loss / take profit)
        self._check_positions()

        # 3. Check daily limits
        if not self.risk.check_daily_limits(self.memory):
            print("  🛑 Daily loss limit hit! Skipping cycle.")
            return

        # 4. Analyze each symbol
        for symbol in CONFIG["symbols"]:
            state = self.market.get_state(symbol)

            # Skip if max positions reached
            if len(self.positions) >= CONFIG["risk"]["max_open_positions"]:
                print(f"  ⏸️  Max positions reached ({len(self.positions)}/{CONFIG['risk']['max_open_positions']})")
                break

            # Build market data for reasoning
            market_data = {
                "symbol": symbol,
                "price": state.price,
                "change_24h": state.change_24h,
            }
            indicators = {
                "rsi": state.rsi,
                "macd": state.macd,
                "macd_signal": state.macd_signal,
                "macd_hist": state.macd_hist,
                "bb_position": state.bb_position,
                "ema_20": state.ema_20,
                "ema_50": state.ema_50,
                "trend": state.trend,
                "volume_ratio": state.volume_ratio,
                "support": state.support,
                "resistance": state.resistance,
            }
            balance = {
                "total_usdt": self.total_balance,
                "usdt_available": self.usdt_available,
            }

            # Run reasoning engine
            decision = await self.reasoning.analyze(market_data, indicators, balance)

            # Log reasoning
            self.reasoning_log.insert(0, {
                "time": datetime.utcnow().strftime("%H:%M:%S"),
                "mood": self.personality.mood,
                "text": decision["thought_process"].split("\n")[0][:120] if decision["thought_process"] else "Analyzing market...",
            })
            # Keep only last 20 entries
            self.reasoning_log = self.reasoning_log[:20]

            if decision["decision"] in ["BUY", "SELL"]:
                # Risk check
                allowed, reason = self.risk.validate_trade(
                    decision, balance, [{"symbol": p.symbol} for p in self.positions]
                )

                if allowed:
                    # Calculate position size
                    trade_value = self.usdt_available * decision["size"]
                    quantity = trade_value / state.price

                    # Round quantity
                    if symbol == "BTCUSDT":
                        quantity = round(quantity, 5)
                    elif symbol == "ETHUSDT":
                        quantity = round(quantity, 4)
                    else:
                        quantity = round(quantity, 2)

                    if quantity > 0 and trade_value > 10:  # Min $10 trade
                        # Simulate slippage (0.05% - 0.2%)
                        slippage = random.uniform(0.0005, 0.002)
                        if decision["decision"] == "BUY":
                            fill_price = state.price * (1 + slippage)
                        else:
                            fill_price = state.price * (1 - slippage)
                        fill_price = round(fill_price, 2)

                        # Deduct from available
                        fee = fill_price * quantity * 0.001  # 0.1% fee
                        cost = fill_price * quantity + fee
                        self.usdt_available -= cost

                        # Create position
                        pos = SimulatedPosition(
                            symbol=symbol,
                            side=decision["decision"],
                            entry_price=fill_price,
                            size=quantity,
                            value=fill_price * quantity,
                            stop_loss=decision.get("stop_loss", fill_price * 0.97),
                            take_profit=decision.get("take_profit", fill_price * 1.05),
                            entry_time=datetime.utcnow().isoformat(),
                            mood_at_entry=self.personality.mood,
                            rsi_at_entry=indicators["rsi"],
                            trend_at_entry=indicators["trend"],
                            reasoning=decision["thought_process"][:200],
                        )
                        self.positions.append(pos)

                        # Record in memory
                        self.memory.record_trade({
                            "symbol": symbol,
                            "side": decision["decision"],
                            "entry_price": fill_price,
                            "size": quantity,
                            "pnl": 0,
                            "status": "open",
                            "reasoning": decision["thought_process"],
                            "mood_at_entry": self.personality.mood,
                            "rsi_at_entry": indicators["rsi"],
                            "trend_at_entry": indicators["trend"],
                        })

                        print(f"  ✅ TRADE: {decision['decision']} {quantity} {symbol} @ ${fill_price:,.2f}")
                        print(f"     Confidence: {decision['confidence']*100:.0f}% | Size: {decision['size']*100:.0f}% portfolio")
                        print(f"     SL: ${decision.get('stop_loss', 0):,.2f} | TP: ${decision.get('take_profit', 0):,.2f}")
                    else:
                        print(f"  ⚠️  Position too small: ${trade_value:.2f}")
                else:
                    print(f"  ❌ RISK BLOCKED: {reason}")
            else:
                print(f"  ⏸️  {symbol}: HOLD — {decision['thought_process'][:80]}...")

        # Update total balance
        position_values = sum(
            p.size * self.market.get_state(p.symbol).price for p in self.positions
        )
        self.total_balance = self.usdt_available + position_values

        # Save live state
        self._save_live_state()

        # Print summary
        stats = self.memory.get_statistics()
        print(f"\n  💼 Balance: ${self.total_balance:,.2f} | Available: ${self.usdt_available:,.2f}")
        print(f"  📊 Positions: {len(self.positions)} | Record: {stats['wins']}W/{stats['losses']}L | P&L: ${stats.get('total_pnl', 0):+.2f}")
        for p in self.positions:
            current = self.market.get_state(p.symbol).price
            unrealized = (current - p.entry_price) * p.size if p.side == "BUY" else (p.entry_price - current) * p.size
            print(f"     {p.side} {p.size} {p.symbol} @ ${p.entry_price:,.2f} | Current: ${current:,.2f} | Unrealized: ${unrealized:+.2f}")

    def _save_live_state(self):
        """Save current state to JSON for dashboard consumption."""
        btc = self.market.btc_state
        eth = self.market.eth_state
        stats = self.memory.get_statistics()

        # Build position data
        position_data = []
        for p in self.positions:
            current_price = self.market.get_state(p.symbol).price
            unrealized = (current_price - p.entry_price) * p.size if p.side == "BUY" else (p.entry_price - current_price) * p.size
            position_data.append({
                "symbol": p.symbol,
                "side": p.side,
                "entry_price": p.entry_price,
                "current_price": current_price,
                "size": p.size,
                "value": p.value,
                "unrealized_pnl": round(unrealized, 2),
                "stop_loss": p.stop_loss,
                "take_profit": p.take_profit,
                "entry_time": p.entry_time,
            })

        # Build recent trades (last 10)
        recent_trades = []
        for t in sorted(self.memory.trades, key=lambda x: x["timestamp"], reverse=True)[:10]:
            recent_trades.append({
                "id": t.get("id", 0),
                "time": t["timestamp"][11:19] if len(t["timestamp"]) > 19 else t["timestamp"],
                "symbol": t["symbol"],
                "side": t["side"],
                "price": t.get("entry_price", 0),
                "size": t.get("size", 0),
                "pnl": t.get("pnl", 0),
                "status": t.get("status", "open"),
                "reasoning": t.get("reasoning", "")[:100],
            })

        # P&L history for chart
        pnl_history = []
        daily_pnl = 0
        last_day = None
        for t in sorted(self.memory.trades, key=lambda x: x["timestamp"]):
            if t["status"] == "closed":
                day = t["timestamp"][:10]
                if day != last_day:
                    if last_day:
                        pnl_history.append({"date": last_day[5:], "pnl": round(daily_pnl, 2)})
                    daily_pnl = 0
                    last_day = day
                daily_pnl += t.get("pnl", 0)
        if last_day:
            pnl_history.append({"date": last_day[5:], "pnl": round(daily_pnl, 2)})

        # If no history, generate some initial data points
        if not pnl_history:
            pnl_history = [{"date": "May 25", "pnl": 0}, {"date": "May 26", "pnl": 0}]

        state = {
            "timestamp": datetime.utcnow().isoformat(),
            "cycle": self.cycle_count,
            "agent": {
                "name": self.personality.name,
                "mood": self.personality.mood,
                "mood_description": self.personality.get_mood_description(),
                "stress_level": round(self.personality.stress_level, 2),
                "streak": self.personality.streak_count,
                "win_rate": round(stats.get("win_rate", 0), 1),
                "total_pnl": round(stats.get("total_pnl", 0), 2),
                "total_trades": stats.get("total_trades", 0),
                "wins": stats.get("wins", 0),
                "losses": stats.get("losses", 0),
            },
            "portfolio": {
                "total_balance": round(self.total_balance, 2),
                "usdt_available": round(self.usdt_available, 2),
                "initial_balance": self.initial_balance,
                "open_positions": len(self.positions),
                "positions": position_data,
            },
            "market": {
                "BTCUSDT": {
                    "price": round(btc.price, 2),
                    "change_24h": btc.change_24h,
                    "rsi": round(btc.rsi, 1),
                    "macd": round(btc.macd, 2),
                    "macd_signal": round(btc.macd_signal, 2),
                    "bb_position": round(btc.bb_position, 2),
                    "trend": btc.trend,
                    "volume_ratio": btc.volume_ratio,
                    "support": round(btc.support, 2),
                    "resistance": round(btc.resistance, 2),
                },
                "ETHUSDT": {
                    "price": round(eth.price, 2),
                    "change_24h": eth.change_24h,
                    "rsi": round(eth.rsi, 1),
                    "macd": round(eth.macd, 2),
                    "macd_signal": round(eth.macd_signal, 2),
                    "bb_position": round(eth.bb_position, 2),
                    "trend": eth.trend,
                    "volume_ratio": eth.volume_ratio,
                    "support": round(eth.support, 2),
                    "resistance": round(eth.resistance, 2),
                },
            },
            "recent_trades": recent_trades,
            "pnl_history": pnl_history,
            "reasoning_log": self.reasoning_log[:10],
        }

        with open(self.live_state_file, "w") as f:
            json.dump(state, f, indent=2)

    async def run(self):
        """Main simulation loop."""
        print("=" * 60)
        print("  🤖 AI TRADER LIVE SIMULATION")
        print("  Paper Trading — No Real Money")
        print("=" * 60)
        print(f"\n  Starting balance: ${self.initial_balance:,.2f}")
        print(f"  Markets: {', '.join(CONFIG['symbols'])}")
        print(f"  Personality: {self.personality.name}")
        print(f"  Cycle interval: {CONFIG['check_interval']}s")
        print("\n  Press Ctrl+C to stop\n")

        self.running = True
        while self.running:
            try:
                await self._run_cycle()
            except Exception as e:
                print(f"  ❌ Cycle error: {e}")

            if self.running:
                await asyncio.sleep(CONFIG["check_interval"])

        print("\n  👋 Simulation stopped")
        print(f"  Final balance: ${self.total_balance:,.2f}")
        stats = self.memory.get_statistics()
        print(f"  Record: {stats['wins']}W/{stats['losses']}L | P&L: ${stats.get('total_pnl', 0):+.2f}")


if __name__ == "__main__":
    sim = TradingSimulator()
    try:
        asyncio.run(sim.run())
    except KeyboardInterrupt:
        sim.running = False
        print("\n\n  👋 Goodbye!")
