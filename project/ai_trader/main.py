#!/usr/bin/env python3
"""
AI Trader — Human-Like Autonomous Trading Agent (Paper Trading)

A human-like AI that autonomously analyzes markets, reasons about trades,
learns from history, and executes paper trades on Binance Testnet.

Usage:
    export BINANCE_API_KEY="your_key"
    export BINANCE_API_SECRET="your_secret"
    python -m ai_trader.main
"""

import os
import sys
import asyncio
import logging
import signal
from datetime import datetime
from pathlib import Path

from config import CONFIG
from personality import Personality
from memory import MemoryAgent
from reasoning import ReasoningEngine
from risk_guardian import RiskGuardian
from market_agent import MarketAgent
from execution import ExecutionAgent


# ─── Logging Setup ───────────────────────────────────────────────────────────

def setup_logging():
    log_format = "%(asctime)s | %(levelname)-8s | %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    
    handlers = [logging.StreamHandler(sys.stdout)]
    if CONFIG["log_file"]:
        handlers.append(logging.FileHandler(CONFIG["log_file"]))
    
    logging.basicConfig(
        level=getattr(logging, CONFIG["log_level"]),
        format=log_format,
        datefmt=date_format,
        handlers=handlers,
    )
    return logging.getLogger("AITrader")


# ─── Banner ──────────────────────────────────────────────────────────────────

def print_banner(personality, cycle=0):
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    name = personality.name
    mood = personality.mood.upper()
    
    print()
    print("=" * 60)
    print(f"  AI Trader: {name} (Paper Trading on Binance Testnet)")
    print(f"  {now} | Cycle #{cycle}")
    print(f"  Mood: {mood}")
    print("=" * 60)


def print_market_snapshot(symbol, price, change_24h, indicators):
    rsi = indicators.get("rsi", 0)
    macd = indicators.get("macd", 0)
    bb_pos = indicators.get("bb_position", 0.5)
    trend = indicators.get("trend", "neutral")
    vol_ratio = indicators.get("volume_ratio", 1.0)
    support = indicators.get("support", 0)
    resistance = indicators.get("resistance", 0)
    
    # BB position as descriptive
    if bb_pos < 0.2:
        bb_desc = "lower band"
    elif bb_pos > 0.8:
        bb_desc = "upper band"
    else:
        bb_desc = "middle"
    
    print(f"\n Market Snapshot -- {symbol}")
    print(f"   Price: ${price:,.2f} | 24h Change: {change_24h:+.2f}%")
    print(f"   RSI: {rsi:.1f} | MACD: {macd:.2f} | BB: {bb_desc}")
    print(f"   Trend: {trend.upper()} | Volume: {vol_ratio:.1f}x avg")
    print(f"   Support: ${support:,.2f} | Resistance: ${resistance:,.2f}")


def print_reasoning(decision):
    print(f"\n {decision['thought_process']}")
    print(f"\n Decision: {decision['decision']}")
    print(f"   Confidence: {decision['confidence']*100:.0f}%")
    
    if decision['decision'] in ["BUY", "SELL"]:
        print(f"   Position Size: {decision['size']*100:.1f}% of portfolio")
        if decision['entry_price']:
            print(f"   Entry: ~${decision['entry_price']:,.2f}")
        if decision['stop_loss']:
            print(f"   Stop Loss: ${decision['stop_loss']:,.2f}")
        if decision['take_profit']:
            print(f"   Take Profit: ${decision['take_profit']:,.2f}")
    
    if decision['reasons']:
        print(f"\n   Reasons:")
        for r in decision['reasons'][:4]:
            print(f"      + {r}")
    
    if decision['risks']:
        print(f"\n   Concerns:")
        for r in decision['risks'][:3]:
            print(f"      ! {r}")


def print_risk_check(allowed, reason):
    status = "PASSED" if allowed else "BLOCKED"
    print(f"\n{'OK' if allowed else 'XX'} Risk Check: {status}")
    if allowed:
        print(f"   {reason}")
    else:
        print(f"   Reason: {reason}")


def print_portfolio(balance, memory):
    stats = memory.get_statistics()
    daily_pnl = memory.get_daily_pnl()
    
    print(f"\n Portfolio: ${balance['total_usdt']:,.2f} USDT")
    print(f"   Available: ${balance['usdt_available']:,.2f} USDT")
    
    if stats["total_trades"] > 0:
        emoji = "+" if daily_pnl >= 0 else "-"
        print(f"   {emoji} Today's P&L: ${daily_pnl:+.2f}")
        print(f"   All-Time: {stats['wins']}W / {stats['losses']}L ({stats['win_rate']:.0f}%)")
        print(f"   Total P&L: ${stats['total_pnl']:+.2f}")


def print_closing(personality):
    print(f"\n{'=' * 60}")
    print(f"{personality.name}'s Mood: {personality.mood.upper()}")
    print(f"   \"{personality.get_mood_description()}\"")
    print(f"\nNext check in {CONFIG['check_interval'] // 60} minutes...")
    print("=" * 60)


# ─── Main Trading Class ──────────────────────────────────────────────────────

class AITrader:
    """Main trading orchestrator."""
    
    def __init__(self):
        self.logger = setup_logging()
        self.running = False
        self.cycle = 0
        
        # Initialize modules
        self.personality = Personality(CONFIG["personality"])
        self.memory = MemoryAgent(CONFIG["memory_file"])
        self.reasoning = ReasoningEngine(self.personality, self.memory)
        self.risk = RiskGuardian(CONFIG["risk"])
        self.market = MarketAgent(
            api_key=CONFIG["api_key"],
            api_secret=CONFIG["api_secret"],
            testnet=CONFIG["testnet"],
        )
        self.execution = ExecutionAgent(
            api_key=CONFIG["api_key"],
            api_secret=CONFIG["api_secret"],
            testnet=CONFIG["testnet"],
        )
        
        # Load personality state from memory if exists
        self._load_state()
    
    def _load_state(self):
        """Load previous personality state from memory file if it exists."""
        import json
        memory_path = Path(CONFIG["memory_file"])
        if memory_path.exists():
            try:
                with open(memory_path) as f:
                    data = json.load(f)
                    # Personality state could be stored in memory in future versions
            except:
                pass
    
    def _signal_handler(self, signum, frame):
        self.logger.info("Shutdown signal received. Stopping gracefully...")
        self.running = False
    
    async def startup_check(self):
        """Verify API connectivity and account status on startup."""
        print("\n" + "=" * 60)
        print("  STARTUP CHECKLIST")
        print("=" * 60)
        
        # 1. Check API keys
        if not CONFIG["api_key"] or not CONFIG["api_secret"]:
            print("WARNING: No API keys set. Using demo mode.")
            print("   Set BINANCE_API_KEY and BINANCE_API_SECRET env vars.")
            print("   Get testnet keys from: https://testnet.binance.vision/")
            self.demo_mode = True
        else:
            print("API keys configured")
            self.demo_mode = False
        
        # 2. Check balance
        print("\n Checking account...")
        balance = await self.market.get_account_balance()
        print(f"   Portfolio value: ${balance['total_usdt']:,.2f} USDT")
        print(f"   Available: ${balance['usdt_available']:,.2f} USDT")
        
        # 3. Test market data
        print("\n Testing market data...")
        for symbol in CONFIG["symbols"]:
            try:
                price = await self.market.get_price(symbol)
                print(f"   {symbol}: ${price:,.2f} OK")
            except Exception as e:
                print(f"   {symbol}: Error - {e} FAIL")
        
        # 4. Load memory
        stats = self.memory.get_statistics()
        if stats["total_trades"] > 0:
            print(f"\n Memory loaded: {stats['total_trades']} past trades")
            print(f"   {self.memory.get_performance_summary()}")
        else:
            print(f"\n Fresh start -- no trade history yet")
        
        # 5. Personality intro
        print(f"\n Personality loaded:")
        print(f"   Name: {self.personality.name}")
        print(f"   Risk Tolerance: {self.personality.risk_tolerance*100:.0f}%")
        print(f"   Patience: {self.personality.patience*100:.0f}%")
        print(f"   Confidence: {self.personality.confidence_level*100:.0f}%")
        
        # 6. Risk settings
        print(f"\n Risk Limits:")
        print(f"   Max Position: {CONFIG['risk']['max_position_pct']*100:.0f}%")
        print(f"   Max Daily Loss: {CONFIG['risk']['max_daily_loss_pct']*100:.0f}%")
        print(f"   Max Open Trades: {CONFIG['risk']['max_open_positions']}")
        print(f"   Max Drawdown: {CONFIG['risk']['max_drawdown_pct']*100:.0f}%")
        
        print("\n" + "=" * 60)
        print("  Ready to trade! Starting main loop...")
        print("=" * 60)
    
    async def run_cycle(self):
        """Run one trading cycle."""
        self.cycle += 1
        print_banner(self.personality, self.cycle)
        
        # Check daily limits
        if not self.risk.check_daily_limits(self.memory):
            print("\n Daily loss limit hit! Taking a break for today.")
            return
        
        for symbol in CONFIG["symbols"]:
            try:
                # 1. Fetch market data
                price = await self.market.get_price(symbol)
                ticker = await self.market.get_ticker_24h(symbol)
                change_24h = ticker["price_change_percent"]
                
                # 2. Get klines and calculate indicators
                df = await self.market.get_klines(symbol, CONFIG["interval"], limit=100)
                df = self.market.calculate_indicators(df)
                structure = self.market.analyze_market_structure(df)
                
                # 3. Prepare indicator dict
                latest = df.iloc[-1]
                indicators = {
                    "rsi": latest["rsi"],
                    "macd": latest["macd"],
                    "macd_signal": latest["macd_signal"],
                    "macd_hist": latest["macd_hist"],
                    "bb_position": latest["bb_position"],
                    "ema_20": latest["ema_20"],
                    "ema_50": latest["ema_50"],
                    "trend": structure["trend"],
                    "volume_ratio": structure["volume_ratio"],
                    "support": structure["support"],
                    "resistance": structure["resistance"],
                }
                
                # 4. Print market snapshot
                print_market_snapshot(symbol, price, change_24h, indicators)
                
                # 5. Get balance
                balance = await self.market.get_account_balance()
                
                # 6. Reasoning engine analyzes and decides
                decision = await self.reasoning.analyze(
                    {"symbol": symbol, "price": price, "change_24h": change_24h},
                    indicators,
                    balance,
                )
                
                # 7. Print reasoning
                print_reasoning(decision)
                
                # 8. Execute or skip
                if decision["decision"] in ["BUY", "SELL"] and not self.demo_mode:
                    # Risk check
                    open_orders = await self.execution.get_open_orders(symbol)
                    allowed, reason = self.risk.validate_trade(
                        decision, balance, open_orders
                    )
                    print_risk_check(allowed, reason)
                    
                    if allowed:
                        # Calculate quantity
                        trade_value = balance["usdt_available"] * decision["size"]
                        quantity = trade_value / price
                        
                        # Round quantity (Binance has minimums)
                        if symbol == "BTCUSDT":
                            quantity = round(quantity, 5)
                        elif symbol == "ETHUSDT":
                            quantity = round(quantity, 4)
                        else:
                            quantity = round(quantity, 2)
                        
                        if quantity <= 0:
                            print("   Warning: Quantity too small, skipping")
                            continue
                        
                        # Place order
                        side = "BUY" if decision["decision"] == "BUY" else "SELL"
                        print(f"\n Executing {decision['decision']} order...")
                        
                        result = await self.execution.place_market_order(
                            symbol=symbol,
                            side=side,
                            quantity=quantity,
                        )
                        
                        if result["success"]:
                            print(f"Order filled!")
                            print(f"   {side} {result['executed_qty']} {symbol} @ ${result['price']:,.2f}")
                            print(f"   Order ID: {result['order_id']}")
                            
                            # Record in memory
                            self.memory.record_trade({
                                "symbol": symbol,
                                "side": decision["decision"],
                                "entry_price": result["price"],
                                "size": quantity,
                                "pnl": 0,
                                "status": "open",
                                "reasoning": decision["thought_process"],
                                "mood_at_entry": self.personality.mood,
                                "rsi_at_entry": indicators["rsi"],
                                "trend_at_entry": indicators["trend"],
                            })
                        else:
                            print(f"Order failed: {result.get('error', 'Unknown error')}")
                    
                    elif not allowed:
                        print(f"   Trade blocked by risk guardian: {reason}")
                
                elif decision["decision"] in ["BUY", "SELL"] and self.demo_mode:
                    print(f"\n [DEMO MODE] Would {decision['decision']} {decision['size']*100:.1f}% of portfolio")
                    # Still record in memory for learning
                    self.memory.record_trade({
                        "symbol": symbol,
                        "side": decision["decision"],
                        "entry_price": price,
                        "size": decision["size"],
                        "pnl": 0,
                        "status": "demo",
                        "reasoning": decision["thought_process"],
                        "mood_at_entry": self.personality.mood,
                        "rsi_at_entry": indicators["rsi"],
                        "trend_at_entry": indicators["trend"],
                    })
                
                else:
                    print(f"\n Holding -- waiting for better setup")
                
                # Update personality emotion
                self.personality.current_balance = balance["total_usdt"]
                
            except Exception as e:
                self.logger.error(f"Error in cycle for {symbol}: {e}")
                print(f"\n Error analyzing {symbol}: {e}")
        
        # Print portfolio and closing
        try:
            balance = await self.market.get_account_balance()
            print_portfolio(balance, self.memory)
        except:
            pass
        
        print_closing(self.personality)
    
    async def run(self):
        """Main trading loop."""
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        await self.startup_check()
        
        self.running = True
        while self.running:
            try:
                await self.run_cycle()
            except Exception as e:
                self.logger.error(f"Cycle error: {e}")
                print(f"\n Cycle error: {e}")
            
            if self.running:
                await asyncio.sleep(CONFIG["check_interval"])
        
        print("\n Shutting down gracefully...")
        self.memory.save()
        print("Memory saved. Goodbye!")


# ─── Entry Point ─────────────────────────────────────────────────────────────

async def main():
    trader = AITrader()
    await trader.run()


if __name__ == "__main__":
    asyncio.run(main())
