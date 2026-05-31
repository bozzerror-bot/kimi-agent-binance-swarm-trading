# Alex V2 — Advanced Scalping AI with Multi-Strategy Learning

## Goals
1. Scalping on 1m + 15m timeframes
2. Auto trendline detection (support/resistance)
3. Learn from 1 month of historical data before trading
4. Real Binance futures TESTNET with 20 coins
5. Multi-strategy brain — Alex picks the best strategy per market condition
6. More human-like: faster decisions, less stress, adaptive personality
7. Real trades on testnet (not simulation)

## Architecture

### Phase 1: Data Collection
- Download 1 month of 1m + 15m historical data for top 20 futures coins
- Binance futures testnet API for live data
- Store as CSV/parquet for fast access

### Phase 2: Technical Analysis Engine
- Auto support/resistance detection (pivot points + clustering)
- Auto trendline detection (linear regression on pivots)
- Advanced indicators: VWAP, Stochastic, ADX, ATR, OBV
- Market regime detection (trending/ranging/volatile)

### Phase 3: Multi-Strategy Brain
- Strategy 1: Mean Reversion (RSI + Bollinger + support bounce)
- Strategy 2: Trend Following (EMA cross + ADX + trendline break)
- Strategy 3: Breakout (volume + resistance break + momentum)
- Strategy 4: Scalping Momentum (VWAP + short-term momentum)
- Strategy Selector: Alex evaluates which fits current market regime

### Phase 4: Backtesting Engine
- Walk-forward backtest on 1 month historical data
- Each strategy tested per coin
- Performance metrics: win rate, Sharpe, max drawdown, profit factor
- Alex "learns" which strategies work for which coins/market conditions

### Phase 5: Live Trading Engine
- Real Binance futures testnet API
- 20 coins portfolio
- 1m + 15m dual timeframe analysis
- Quick execution: 10-second cycles
- Adaptive personality: learns from wins/losses per strategy
- Position sizing: dynamic based on conviction + volatility (ATR)

### Phase 6: Dashboard Update
- Live positions from testnet
- Real P&L from Binance
- Strategy performance per coin
- Trendline visualization
- Market regime indicator

## Top 20 Futures Coins
BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, DOT, MATIC, LTC, UNI, ATOM, ETC, FIL, ARB, OP, SUI, TIA
