# Alex V4 Build Plan — Continue from Interrupted Session

## Current State
- Project at `$HOME/app-v4/` with V3 base code
- Store, StudyMarket, Dashboard, TradingEngine all written
- Build was interrupted mid-process — need to fix bugs, add routes, add CSS animations

## Issues Found
1. **CRITICAL**: `useBinancePrices.ts` imports `FUTURES_COINS` but store exports `COINS`
2. **CRITICAL**: `Settings.tsx` imports `FUTURES_COINS` but store exports `COINS`
3. **App.tsx** missing `/study` route for StudyMarket
4. **Navbar.tsx** missing "Study" tab with progress badge
5. **Dashboard.tsx** has simple emoji circle — needs animated CSS Alex character
6. **index.css** missing Alex CSS animations (breathing, blinking, mood colors)
7. **useTradingEngine.ts** doesn't use market study data for confidence
8. **Layout.tsx** footer says "V3" → "V4"

## Stage 1: Parallel Agent Dispatch (3 agents)

### Agent 1: BugFix_Wiring
- Fix `useBinancePrices.ts`: change `FUTURES_COINS` → `COINS`, adapt code
- Fix `Settings.tsx`: change `FUTURES_COINS` → `COINS`, adapt code
- Update `App.tsx`: add `/study` route for StudyMarket
- Update `Navbar.tsx`: add Study tab with progress badge
- Update `Layout.tsx`: footer "V4"

### Agent 2: Dashboard_V4
- Rewrite Dashboard.tsx with:
  - Animated CSS AlexAvatar component (breathing, blinking, mood glows)
  - Trend direction arrows (↗/↘/→) with colors per coin
  - S/R level display from marketStudyData
  - Market study lock overlay on positions when not complete
  - Keep all existing functionality (P&L chart, positions, coin grid, reasoning log)

### Agent 3: CSS_Engine
- Add Alex character CSS animations to `index.css`:
  - `.alex-avatar` breathing animation
  - `.alex-eyes` blinking animation  
  - `.alex-mood-*` glow color variants
  - `.alex-head` shape styling
- Enhance `useTradingEngine.ts` to integrate marketStudyData:
  - Trend alignment bonus (+0.1) when trade direction matches study trend
  - S/R proximity check — avoid entries too close to S/R
  - Higher confidence when market study supports the setup

## Stage 2: Build & Deploy (Main Agent)
- Build, fix any errors, deploy
