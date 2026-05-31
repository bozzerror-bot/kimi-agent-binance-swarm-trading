#!/usr/bin/env python3
"""
Alex V2 — Advanced Scalping AI
Main orchestrator: connects TA Engine, Strategy Brain, Futures Trader, and Alex's Brain.

Usage:
    export BINANCE_API_KEY="your_key"
    export BINANCE_API_SECRET="your_secret"
    python main.py --mode backtest   # Learn from 1 month of history
    python main.py --mode live       # Trade on Binance futures testnet
    python main.py --mode paper      # Paper trading (mock execution)
"""

import os
import sys
import time
import json
import asyncio
import argparse
import logging
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
import numpy as np

from ta_engine import TAEngine
from strategy_brain import StrategyBrain, Backtester
from futures_trader import FuturesTrader
from alex_brain import AlexBrain


# ─── Logging ─────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("AlexV2")

# ─── Configuration ───────────────────────────────────────────────────────────

COINS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
    "DOGEUSDT", "ADAUSDT", "AVAXUSDT", "LINKUSDT", "DOTUSDT",
    "MATICUSDT", "LTCUSDT", "UNIUSDT", "ATOMUSDT", "ETCUSDT",
    "FILUSDT", "ARBUSDT", "OPUSDT", "SUIUSDT", "TIAUSDT"
]

TIMEFRAMES = {
    "primary": "15m",    # Main analysis timeframe
    "scalp": "1m",       # Entry/exit timing
}

DATA_DIR = Path(__file__).parent.parent / "data"
STATE_DIR = Path(__file__).parent.parent / "state"
STATE_DIR.mkdir(exist_ok=True)


# ─── Banner ──────────────────────────────────────────────────────────────────

def print_banner():
    print()
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║                                                              ║")
    print("║     🤖 ALEX V2 — ADVANCED SCALPING AI                      ║")
    print("║     Multi-Strategy • Auto Trendlines • Futures Scalper     ║")
    print("║                                                              ║")
    print("╚══════════════════════════════════════════════════════════════╝")
    print()


# ─── Data Loader ─────────────────────────────────────────────────────────────

def load_historical_data():
    """Load 1 month of real Binance historical data for all 20 coins."""
    logger.info("Loading historical data...")
    all_data = {}

    for file in DATA_DIR.glob("*.csv"):
        try:
            df = pd.read_csv(file)
            for symbol in df['symbol'].unique():
                sym_df = df[df['symbol'] == symbol].copy()
                sym_df = sym_df.sort_values('open_time')
                sym_df.set_index('open_time_formatted', inplace=True)
                # Rename columns to standard OHLCV
                col_map = {
                    'open': 'open', 'high': 'high', 'low': 'low',
                    'close': 'close', 'volume': 'volume'
                }
                sym_df = sym_df.rename(columns=col_map)
                for col in ['open', 'high', 'low', 'close', 'volume']:
                    if col in sym_df.columns:
                        sym_df[col] = pd.to_numeric(sym_df[col], errors='coerce')
                sym_df['symbol'] = symbol
                all_data[symbol] = sym_df[['open', 'high', 'low', 'close', 'volume', 'symbol']].dropna()
        except Exception as e:
            logger.warning(f"Error loading {file}: {e}")

    logger.info(f"Loaded data for {len(all_data)} coins")
    for sym, df in list(all_data.items())[:5]:
        logger.info(f"  {sym}: {len(df)} candles ({df.index[0]} → {df.index[-1]})")
    return all_data


# ─── Backtest Phase — Alex Learns from History ───────────────────────────────

def run_backtest_phase(historical_data):
    """
    Phase 1: Alex learns from 1 month of historical data.
    Backtests all 4 strategies on all 20 coins.
    Saves performance summary to state.
    """
    print("\n" + "=" * 60)
    print("  📚 PHASE 1: LEARNING FROM 1 MONTH OF HISTORY")
    print("=" * 60 + "\n")

    results = {}
    backtester = Backtester()

    for symbol, df in historical_data.items():
        if len(df) < 100:
            continue

        print(f"\n  📊 Backtesting {symbol}...")

        # Build TA indicators
        ta = TAEngine(df)
        df_with_indicators = ta.calculate_all_indicators()

        # Build strategy brain
        brain = StrategyBrain(df_with_indicators)

        # Backtest all strategies
        coin_results = brain.backtest_all(df_with_indicators)
        results[symbol] = coin_results

        # Print summary
        for strategy_name, result in coin_results.items():
            if result['total_trades'] > 0:
                emoji = "✅" if result['total_pnl'] > 0 else "❌"
                print(f"     {emoji} {strategy_name:20s} | {result['total_trades']:2d} trades | "
                      f"WR: {result['win_rate']:5.1f}% | P&L: ${result['total_pnl']:8.2f} | "
                      f"Sharpe: {result['sharpe_ratio']:5.2f} | MaxDD: {result['max_drawdown']:5.2f}%")

    # Save results
    summary = {}
    for symbol, strategies in results.items():
        summary[symbol] = {}
        for name, res in strategies.items():
            summary[symbol][name] = {
                'trades': res['total_trades'],
                'win_rate': res['win_rate'],
                'pnl': res['total_pnl'],
                'sharpe': res['sharpe_ratio'],
                'max_dd': res['max_drawdown'],
            }

    with open(STATE_DIR / "backtest_results.json", "w") as f:
        json.dump(summary, f, indent=2)

    # Print overall summary
    print("\n" + "=" * 60)
    print("  📈 OVERALL BACKTEST SUMMARY")
    print("=" * 60)

    strategy_totals = {}
    for symbol_results in results.values():
        for name, res in symbol_results.items():
            if name not in strategy_totals:
                strategy_totals[name] = {'trades': 0, 'wins': 0, 'pnl': 0, 'sharpe_sum': 0, 'count': 0}
            strategy_totals[name]['trades'] += res['total_trades']
            strategy_totals[name]['pnl'] += res['total_pnl']
            if res['total_trades'] > 0:
                strategy_totals[name]['sharpe_sum'] += res['sharpe_ratio']
                strategy_totals[name]['count'] += 1

    for name, totals in strategy_totals.items():
        avg_sharpe = totals['sharpe_sum'] / totals['count'] if totals['count'] > 0 else 0
        emoji = "🥇" if totals['pnl'] > 0 else "⚠️"
        print(f"  {emoji} {name:20s} | {totals['trades']:3d} trades | Total P&L: ${totals['pnl']:10.2f} | Avg Sharpe: {avg_sharpe:5.2f}")

    return results


# ─── Trading Phase — Alex Goes Live ──────────────────────────────────────────

class AlexV2Trader:
    """Main trading orchestrator for Alex V2."""

    def __init__(self, mode="paper"):
        self.mode = mode
        self.coins = COINS
        self.alex = AlexBrain()
        self.trader = FuturesTrader(
            api_key=os.getenv("BINANCE_API_KEY", ""),
            api_secret=os.getenv("BINANCE_API_SECRET", ""),
            testnet=True,
        )
        self.cycle = 0
        self.running = False

        # Load backtest results if available
        self.backtest_results = self._load_backtest_results()
        if self.backtest_results:
            logger.info("✅ Loaded backtest results — Alex has market memory")

    def _load_backtest_results(self):
        path = STATE_DIR / "backtest_results.json"
        if path.exists():
            with open(path) as f:
                return json.load(f)
        return None

    async def run_cycle(self):
        """One trading cycle: scan → analyze → decide → execute."""
        self.cycle += 1
        cycle_start = time.time()

        print(f"\n{'='*60}")
        print(f"  🔄 CYCLE #{self.cycle} | {datetime.utcnow().strftime('%H:%M:%S')} UTC")
        print(f"  😊 {self.alex.name}: {self.alex.mood.upper()} | Stress: {self.alex.stress:.1f}")
        print(f"{'='*60}")

        # 1. Stress naturally decays
        self.alex.update_stress("cycle")

        # 2. Quick filter — should Alex trade right now?
        if not self.alex.should_trade_now():
            print(f"  ⏸️  Alex says: '{self.alex._generate_reasoning(None, 'hesitant')}'")
            return

        # 3. Scan all 20 coins
        print(f"\n  🔍 Scanning {len(self.coins)} coins...")
        try:
            scan_results = self.trader.scan_all_coins(self.coins, interval="15m", limit=50)
        except Exception as e:
            logger.error(f"Scan failed: {e}")
            return

        # 4. Analyze top opportunities
        opportunities = []
        for coin_data in scan_results.get('coins', []):
            symbol = coin_data['symbol']

            try:
                # Get klines for TA
                df = self.trader.get_klines(symbol, "15m", limit=100)
                if len(df) < 50:
                    continue

                # Build TA engine
                ta = TAEngine(df)
                df_ind = ta.calculate_all_indicators()

                # Get market regime
                regime = ta.detect_market_regime()

                # Build strategy brain
                brain = StrategyBrain(df_ind)

                # Select best strategy for this regime
                strategy_name = brain.select_strategy(regime, symbol)

                # Get strategy signal
                signal = brain.get_strategy_signal(strategy_name)

                # Get TA summary
                ta_summary = ta.get_signal_summary()

                # Alex analyzes the opportunity
                opportunity = self.alex.analyze_opportunity(coin_data, signal, ta_summary)

                if opportunity and opportunity.get('action') in ['BUY', 'SELL']:
                    opportunities.append({
                        'symbol': symbol,
                        'opportunity': opportunity,
                        'signal': signal,
                        'ta_summary': ta_summary,
                        'regime': regime,
                        'strategy': strategy_name,
                        'quality': opportunity.get('signal_quality', 0),
                    })

            except Exception as e:
                logger.debug(f"Error analyzing {symbol}: {e}")
                continue

        # 5. Sort by signal quality and take top 3
        opportunities.sort(key=lambda x: x['quality'], reverse=True)
        top_opps = opportunities[:3]

        if not top_opps:
            print(f"\n  ⏸️  No good setups this cycle. Alex is watching...")
            return

        # 6. Execute trades for top opportunities
        print(f"\n  🎯 Top {len(top_opps)} opportunities:")
        for opp in top_opps:
            await self._execute_trade(opp)

        # 7. Check existing positions (SL/TP management)
        await self._manage_positions()

        cycle_time = time.time() - cycle_start
        print(f"\n  ⏱️  Cycle completed in {cycle_time:.1f}s")

    async def _execute_trade(self, opp):
        """Execute a single trade based on Alex's analysis."""
        symbol = opp['symbol']
        action = opp['opportunity']['action']
        quality = opp['opportunity']['signal_quality']
        size_pct = opp['opportunity']['position_size']

        print(f"\n  💡 {symbol} | Strategy: {opp['strategy']} | Regime: {opp['regime']}")
        print(f"     Quality: {quality:.2f} | Size: {size_pct*100:.1f}% | Action: {action}")
        print(f"     🧠 \"{opp['opportunity']['reasoning']}\"")

        # Get current price
        ticker = self.trader.get_ticker(symbol)
        price = ticker['price']

        # Calculate position size
        account = self.trader.get_account_info()
        balance = account.get('available_balance', 10000)

        atr = opp['ta_summary'].get('atr', price * 0.02)
        quantity = self.trader.calculate_position_size(symbol, quality, atr, balance)

        # Calculate bracket (entry, SL, TP)
        side = "BUY" if action == "BUY" else "SELL"
        bracket = self.trader.calculate_bracket_order(symbol, side, price, atr, quantity)

        print(f"     📊 Entry: ${bracket['entry']:,.2f} | SL: ${bracket['stop_loss']:,.2f} | TP: ${bracket['take_profit']:,.2f}")
        print(f"     📏 Size: {quantity} contracts | R:R = 1:{bracket['rr_ratio']:.1f}")

        if self.mode == "paper":
            # Simulate execution
            print(f"     📝 [PAPER] Simulated {side} {quantity} {symbol}")
            trade_record = {
                'symbol': symbol,
                'side': side,
                'entry': bracket['entry'],
                'quantity': quantity,
                'stop_loss': bracket['stop_loss'],
                'take_profit': bracket['take_profit'],
                'strategy': opp['strategy'],
                'regime': opp['regime'],
                'quality': quality,
                'reasoning': opp['opportunity']['reasoning'],
                'timestamp': datetime.utcnow().isoformat(),
                'status': 'open',
            }
            self._save_trade(trade_record)

        elif self.mode == "live":
            # Real execution on testnet
            try:
                order = self.trader.place_market_order(symbol, side, quantity)
                if order.get('success'):
                    # Set SL and TP
                    sl_side = "SELL" if side == "BUY" else "BUY"
                    self.trader.place_stop_loss(symbol, sl_side, bracket['stop_loss'], quantity)
                    self.trader.place_take_profit(symbol, sl_side, bracket['take_profit'], quantity)
                    print(f"     ✅ Executed {side} {quantity} {symbol} @ ${order.get('price', price):,.2f}")
                else:
                    print(f"     ❌ Order failed: {order.get('error', 'unknown')}")
            except Exception as e:
                logger.error(f"Execution error: {e}")

    async def _manage_positions(self):
        """Monitor and manage open positions."""
        try:
            positions = self.trader.get_all_positions()
            if positions:
                print(f"\n  📂 Open positions: {len(positions)}")
                for pos in positions:
                    pnl = pos.get('unrealized_pnl', 0)
                    emoji = "🟢" if pnl > 0 else "🔴"
                    print(f"     {emoji} {pos['symbol']} {pos['side']} | "
                          f"Size: {pos['size']} | Entry: ${pos['entry']:,.2f} | "
                          f"Mark: ${pos['mark_price']:,.2f} | P&L: ${pnl:+.2f}")
        except Exception as e:
            logger.debug(f"Position management error: {e}")

    def _save_trade(self, trade):
        """Save paper trade to state file."""
        trades_file = STATE_DIR / "paper_trades.json"
        trades = []
        if trades_file.exists():
            with open(trades_file) as f:
                trades = json.load(f)
        trades.append(trade)
        with open(trades_file, "w") as f:
            json.dump(trades, f, indent=2)

    async def run(self):
        """Main trading loop."""
        print_banner()

        # Show config
        print(f"  Mode: {self.mode.upper()}")
        print(f"  Coins: {len(self.coins)}")
        print(f"  Primary TF: {TIMEFRAMES['primary']}")
        print(f"  Scalp TF: {TIMEFRAMES['scalp']}")
        print(f"  Backtest memory: {'YES' if self.backtest_results else 'NO'}")
        print()

        if self.mode == "paper":
            print("  📝 PAPER TRADING — Simulated execution, no real money")
        elif self.mode == "live":
            print("  ⚡ LIVE TRADING — Real orders on Binance Futures TESTNET")

        print("\n  Press Ctrl+C to stop\n")

        self.running = True
        while self.running:
            try:
                await self.run_cycle()
            except KeyboardInterrupt:
                self.running = False
                break
            except Exception as e:
                logger.error(f"Cycle error: {e}")

            if self.running:
                await asyncio.sleep(15)  # 15-second cycles for scalping

        print("\n  👋 Alex V2 shutting down...")
        self.alex._save_state()
        print(f"  💾 State saved. Goodbye!")


# ─── Main Entry ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Alex V2 — Advanced Scalping AI")
    parser.add_argument("--mode", choices=["backtest", "paper", "live"], default="paper",
                        help="Run mode: backtest=learn from history, paper=simulated trading, live=testnet trading")
    parser.add_argument("--coins", nargs="+", default=COINS, help="Coins to trade")
    args = parser.parse_args()

    if args.mode == "backtest":
        print_banner()
        data = load_historical_data()
        if not data:
            print("❌ No historical data found. Run data download first.")
            sys.exit(1)
        run_backtest_phase(data)
    else:
        trader = AlexV2Trader(mode=args.mode)
        trader.coins = args.coins
        try:
            asyncio.run(trader.run())
        except KeyboardInterrupt:
            print("\n\n  👋 Goodbye!")


if __name__ == "__main__":
    main()
