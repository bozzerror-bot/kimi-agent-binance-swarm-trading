# Alex V3 — Complete Rebuild Plan

## Problems Identified from Screenshot
1. **Logs are 100% fake** — Hardcoded May 31 dates, $43,250 BTC prices — never changes
2. **Only 3 coins** — User wants 20 Binance FUTURES perp coins
3. **No leverage** — Need x10/x20 futures leverage
4. **State lost on navigation** — React state resets when switching pages
5. **No API key input** — Settings has no place to enter Binance testnet keys
6. **Alex auto-trades** — No ON/OFF toggle for trading
7. **No BOS/CHoCH** — Missing SMC concepts (Break of Structure, Change of Character)

## Architecture Changes

### State Management: Zustand Store
- Global store with localStorage persistence
- State survives navigation between Dashboard/Settings/Logs
- Survives page refresh

### Data: Zero Fake Data
- All prices from Binance public API (free, no key)
- All trades from actual Alex decisions
- Empty states shown when no data exists

### 20 Binance USD-M Futures Coins
```
BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, DOGEUSDT, ADAUSDT, 
AVAXUSDT, LINKUSDT, DOTUSDT, MATICUSDT, LTCUSDT, UNIUSDT, ATOMUSDT,
ETCUSDT, FILUSDT, ARBUSDT, OPUSDT, SUIUSDT, TIAUSDT
```

### Leverage System
- Confidence 0.7-0.8 → x10 leverage
- Confidence 0.8-0.9 → x15 leverage  
- Confidence 0.9+ → x20 leverage
- Confidence < 0.7 → No trade

### SMC Strategy (Smart Money Concepts)
- **BOS** (Break of Structure): Price breaks previous high/low
- **CHoCH** (Change of Character): Shift from bullish to bearish structure
- **Order Blocks**: Identify where institutions bought/sold
- **Liquidity Sweeps**: Stop hunt detection
- **Trend Structure**: Higher highs/lows vs lower highs/lows

### API Key Management
- Input fields in Settings for API Key + Secret
- Saved to localStorage (encrypted with simple obfuscation)
- Test connection button
- Status indicator

### Trade Toggle
- Master ON/OFF switch in Dashboard
- "Start Trading" / "Stop Trading" with confirmation
- Alex analyzes but doesn't trade when OFF
- Shows "Analysis Only" mode

### Learning Phase
- On first run: Download 1 month of 15m data for all 20 coins
- Run strategy analysis on historical data
- Build coin rankings before taking first trade
