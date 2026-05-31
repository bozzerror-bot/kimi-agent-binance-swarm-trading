# Alex AI Trading Agent — Full Project Context

## Project Identity
- **Name**: Alex V7 (was V6 with bug fixes)
- **Type**: AI-powered crypto scalping bot with web dashboard
- **Stack**: React 19 + TypeScript + Vite + Tailwind CSS v3 + shadcn/ui
- **Live URL**: https://sxj3rmhg2hbca.kimi.page
- **Git Branch**: v7-fix at /mnt/agents/output/app
- **Source Code**: $HOME/app-v7/src/

## Tech Stack Details
- Node.js 20, Tailwind CSS v3.4.19, Vite v7.2.4
- React 19 + TypeScript + HashRouter
- State: Zustand with persist middleware (localStorage key: `alex-v6`)
- Charts: lightweight-charts v5.2.0 (TradingView)
- Charts UI: Recharts (for P&L area chart)
- Animations: Framer Motion + CSS keyframes
- Icons: Lucide React

## File Structure
```
src/
  store/useAlexStore.ts    — Global state + persist
  hooks/useBinancePrices.ts — Price fetcher (3s interval, two-stage)
  hooks/useTradingEngine.ts — Trading algorithm (8s interval)
  pages/Dashboard.tsx       — Main dashboard (animated Alex, positions, P&L)
  pages/StudyMarket.tsx     — Market study page (download 15m+1h klines)
  pages/ChartVisualizer.tsx — Candlestick charts with L/S markers
  pages/Logs.tsx            — Trade logs with filters, CSV export
  pages/Settings.tsx        — Personality, sizing, API keys, coins
  components/Navbar.tsx     — Navigation with badges
  components/Layout.tsx     — Page wrapper
  App.tsx                   — Routes + engine mount
  main.tsx                  — Entry point
  index.css                 — All CSS animations (Alex avatar, radar, etc.)
```

## Store Architecture (useAlexStore.ts)

### State Fields:
- `coins[]` — 20 CoinData objects with live prices
- `priceHistory` — Record<string, number[]> for each coin
- `positions[]` — Open/closed positions with full trade data
- `trades[]` — Trade log entries
- `reasoning[]` — Alex's thought process entries
- `pnlHistory[]` — Daily P&L for chart
- `mood` — neutral/focused/confident/fearful/greedy/etc.
- `stressLevel` — 0-1 number
- `marketStudyComplete` — Boolean gate for trading
- `marketStudyData` — Record<string, StudyCoinData> with S/R, trends
- `strategyStats` — Win rates per strategy (BOS/CHoCH/TREND/SCALP)
- `settings` — All user-configurable settings

### Persisted in localStorage:
Settings, positions, trades, P&L history, mood, stress, market study data, strategy stats

### 20 Coins (COINS array):
BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, DOGEUSDT, ADAUSDT, AVAXUSDT, LINKUSDT, DOTUSDT, MATICUSDT, LTCUSDT, UNIUSDT, ATOMUSDT, ETCUSDT, FILUSDT, ARBUSDT, OPUSDT, SUIUSDT, TIAUSDT

## Trading Engine (useTradingEngine.ts)

### Cycle: Every 8 seconds
1. Update position prices from priceMap
2. Check SL/TP for open positions (uses study S/R for dynamic levels)
3. Gate: Must have marketStudyComplete = true
4. Patience gate: random() > patience/100 skips cycle
5. Max 5 open positions
6. Analyze top 5 candidate coins per cycle

### Strategies:
- **BOS** (Break of Structure) — Price breaks previous swing high/low, +0.35 confidence
- **CHoCH** (Change of Character) — Trend reversal signal, +0.35 confidence
- **TREND** — Strong EMA 9>20>50 alignment, +0.25 confidence
- **SCALP** — Momentum-based quick entry, +0.10 confidence

### Confidence Calculation (10 factors):
1. BOS signal (+0.35)
2. CHoCH signal (+0.35)
3. TREND EMA alignment (+0.25)
4. EMA 9/20 cross (+0.15)
5. Momentum (>0.8% move) (+0.10)
6. Volatility check (+0.10)
7. Trend alignment from study (+0.15)
8. Historical win rate boost (+0.10 max)
9. Multi-timeframe confluence (+0.10)
10. Stress penalty (-0.20 x stress)

### Entry Requirements:
- Minimum confidence: 70% (0.7)
- Position sizing: $100 at 70%, $150 at 85%, $200 at 95%
- Leverage: 10x at 70%, 15x at 85%, 20x at 95%
- Uses REAL 15m + 1h klines from Binance Futures API

### SL/TP:
- Base: SL -1.5%, TP +2.5% from entry
- Enhanced: Uses study S/R levels (SL below support, TP at resistance)

## Price Fetcher (useBinancePrices.ts)
- Two-stage fetch: `/ticker/price` + `/ticker/24hr`
- 3-second interval
- Updates store coins + price history

## Market Study (StudyMarket.tsx)
- Downloads 500 x 15m candles + 200 x 1h candles per coin
- Calculates: EMA trend (9/20/50), Support/Resistance (avg of 15 highs/lows), ATR volatility
- Stores in `marketStudyData` with `lastUpdated` timestamp
- Auto-expires after 4 hours (forces re-study)
- Takes ~30 seconds for all 20 coins

## Human-Like Reasoning
Alex generates conversational trade messages like:
- "I'm seeing a **bullish CHoCH** on BTC — structure just shifted. Going **LONG** with 10x leverage."
- "**BOS** confirmed on ETH — broke structure to the downside. **SHORT** with 15x."

Messages use **bold** for strategy names and trade directions.

## CSS Animations (index.css)
- `.alex-head` + `.alex-mood-*` — Breathing avatar with mood-colored glow
- `.alex-eyes` — Blinking animation (4s cycle)
- `.jarvis-ring` — Holographic rotating ring around avatar
- `.speech-bubble` — Animated speech bubble with arrow
- `.typing` + `.typing-dot` — Three dot typing animation
- `.radar-container` — Market scanning radar with sweep
- `.ls-marker` — Green L / Red S circle markers
- `.trend-arrow` — Pulsing trend direction arrows

## All Bugs Found & Fixed (History):
1. **V4**: Import errors (FUTURES_COINS vs COINS), missing routes
2. **V5**: Price accuracy (added two-stage fetch), missing timeframe display
3. **V6**: Chart not live-updating (fixed by recreating chart on coin change)
4. **V7**: Study lock not reactive (fixed with explicit store subscription), S/R showing $0 for low-priced coins (added smart formatter)

## Settings Available:
- Entry Size: $100 / $150 / $200
- Leverage: 10x / 15x / 20x
- Interval: 1m / 5m / 15m / 1h
- Personality: Risk Tolerance, Confidence, Patience, Adaptability (sliders 1-100)
- Coins: Toggle any of 20 coins
- API: Binance testnet key/secret input
- Reset: Danger zone to clear all data

## Key Design Decisions:
- Trading is LOCKED until market study completes
- Strategy stats auto-track win/loss per strategy
- Stress level affects confidence (high stress = fewer trades)
- Patience slider controls trade frequency
- All data persisted in browser localStorage
- Dark theme: #050507 background, #13131e cards

## API Endpoints Used:
- `https://fapi.binance.com/fapi/v1/ticker/price` — Current prices
- `https://fapi.binance.com/fapi/v1/ticker/24hr` — 24h stats
- `https://fapi.binance.com/fapi/v1/klines?symbol=X&interval=Y&limit=Z` — Historical candles
