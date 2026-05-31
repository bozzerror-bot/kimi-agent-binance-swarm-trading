# Alex V4 — Study Market + Trend Strategy + Animated Character

## Goals
1. **Study Market tab** — Download 1 month historical data before trading unlocks
2. **Trend strategy** — Trendlines, S/R, break detection (simplified, confidence-based)
3. **Animated Alex** — CSS-animated character with mood expressions
4. **Quick scalping** — Fast in/out, confidence > 70% = trade

## Agent Plan
- **Agent 1: Store + Study Page** — Zustand updates, StudyMarket page with data downloader
- **Agent 2: Enhanced Dashboard** — Trendlines, S/R display, animated Alex character, simplified strategy
- **Agent 3: Navbar + App wiring** — Add Study Market tab, wire everything together

## Key Design Decisions
- Strategy: SIMPLIFIED. Confidence-based. Market study + trend alignment + price action.
- NO complex multi-strategy switching. Just: analyze → score confidence → trade if > 70%.
- Animated Alex: Pure CSS, no external assets needed.
- Study Market: Uses Binance Futures API (free) to download historical klines.
