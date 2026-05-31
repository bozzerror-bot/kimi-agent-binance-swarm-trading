import { useState, useEffect, useRef, useCallback } from 'react';
import type { Trade, StrategyInfo, MarketData, SRLevels, ReasoningEntry, Position } from '../data/mockData';

/* ═══════════════════════════════════════════════════════════
   20 COINS CONFIG
   ═══════════════════════════════════════════════════════════ */
export interface CoinConfig {
  symbol: string;
  name: string;
  price: number;
}

export const COINS: CoinConfig[] = [
  { symbol: 'BTCUSDT', name: 'Bitcoin', price: 43250 },
  { symbol: 'ETHUSDT', name: 'Ethereum', price: 2780 },
  { symbol: 'SOLUSDT', name: 'Solana', price: 145 },
  { symbol: 'BNBUSDT', name: 'BNB', price: 595 },
  { symbol: 'XRPUSDT', name: 'XRP', price: 0.52 },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0.16 },
  { symbol: 'ADAUSDT', name: 'Cardano', price: 0.45 },
  { symbol: 'AVAXUSDT', name: 'Avalanche', price: 35 },
  { symbol: 'LINKUSDT', name: 'Chainlink', price: 17 },
  { symbol: 'DOTUSDT', name: 'Polkadot', price: 7.2 },
  { symbol: 'MATICUSDT', name: 'Polygon', price: 0.65 },
  { symbol: 'LTCUSDT', name: 'Litecoin', price: 82 },
  { symbol: 'UNIUSDT', name: 'Uniswap', price: 9.5 },
  { symbol: 'ATOMUSDT', name: 'Cosmos', price: 8.1 },
  { symbol: 'ETCUSDT', name: 'Ethereum Classic', price: 28 },
  { symbol: 'FILUSDT', name: 'Filecoin', price: 5.8 },
  { symbol: 'ARBUSDT', name: 'Arbitrum', price: 1.05 },
  { symbol: 'OPUSDT', name: 'Optimism', price: 2.4 },
  { symbol: 'SUIUSDT', name: 'Sui', price: 1.15 },
  { symbol: 'TIAUSDT', name: 'Celestia', price: 6.8 },
];

/* ═══════════════════════════════════════════════════════════
   STRATEGY TYPES
   ═══════════════════════════════════════════════════════════ */
const STRATEGIES = ['mean_reversion', 'trend_following', 'breakout', 'vwap_scalp'] as const;
type StrategyName = typeof STRATEGIES[number];

// Market regimes: trending, ranging, volatile, mixed

function pickStrategy(regime: string): StrategyInfo {
  const rand = Math.random();
  let name: StrategyName;

  switch (regime) {
    case 'trending':
      name = rand < 0.6 ? 'trend_following' : 'vwap_scalp';
      break;
    case 'ranging':
      name = rand < 0.6 ? 'mean_reversion' : 'vwap_scalp';
      break;
    case 'volatile':
      name = rand < 0.5 ? 'breakout' : 'mean_reversion';
      break;
    case 'mixed':
      name = rand < 0.5 ? 'vwap_scalp' : STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
      break;
    default:
      name = 'vwap_scalp';
  }

  return {
    name,
    confidence: 0.5 + Math.random() * 0.4,
    regime,
  };
}

/* ═══════════════════════════════════════════════════════════
   TECHNICAL INDICATORS
   ═══════════════════════════════════════════════════════════ */
function calculateATR(history: number[]): number {
  if (history.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < history.length; i++) {
    sum += Math.abs(history[i] - history[i - 1]);
  }
  return sum / (history.length - 1);
}

function calculateRSI(history: number[], period = 14): number {
  if (history.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = history.length - period; i < history.length; i++) {
    const change = history[i] - history[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

export function detectRegime(history: number[]): string {
  if (history.length < 10) return 'mixed';
  const atr = calculateATR(history);
  const adxProxy = Math.abs(history[history.length - 1] - history[0]) / history[0];
  if (adxProxy > 0.02 && atr > history[0] * 0.008) return 'trending';
  if (atr < history[0] * 0.005) return 'ranging';
  if (atr > history[0] * 0.015) return 'volatile';
  return 'mixed';
}

export function generateSRLevels(_price: number, history: number[]): SRLevels {
  const recent = history.slice(-30);
  const support = Math.min(...recent) * 0.998;
  const resistance = Math.max(...recent) * 1.002;
  return { support: Math.round(support * 100) / 100, resistance: Math.round(resistance * 100) / 100 };
}

/* ═══════════════════════════════════════════════════════════
   PRICE SIMULATION
   ═══════════════════════════════════════════════════════════ */
function generateSparkline(basePrice: number, points = 30): number[] {
  const data: number[] = [];
  let price = basePrice;
  const volatility = basePrice * 0.003;
  for (let i = 0; i < points; i++) {
    price = price + (Math.random() - 0.48) * volatility;
    data.push(Math.round(price * 100) / 100);
  }
  return data;
}

function simulatePriceMovement(currentPrice: number, basePrice: number): number {
  const volatility = basePrice * 0.002;
  const drift = (basePrice - currentPrice) * 0.02;
  const change = drift + (Math.random() - 0.5) * volatility;
  const newPrice = currentPrice + change;
  return Math.round(newPrice * 100) / 100;
}

/* ═══════════════════════════════════════════════════════════
   TRADE GENERATION
   ═══════════════════════════════════════════════════════════ */
let tradeIdCounter = 100;

function generateMockTrade(
  symbol: string,
  currentPrice: number,
  strategy: StrategyInfo
): Trade {
  tradeIdCounter++;
  const side = Math.random() > 0.45 ? 'BUY' : 'SELL';
  const priceDelta = currentPrice * 0.003;
  const entryPrice = Math.round((currentPrice + (Math.random() - 0.5) * priceDelta) * 100) / 100;
  const exitPrice = Math.round(
    (entryPrice + (side === 'BUY' ? 1 : -1) * Math.random() * priceDelta) * 100
  ) / 100;
  const size = Math.round((0.001 + Math.random() * 0.05) * 1000) / 1000;
  const pnl = Math.round((exitPrice - entryPrice) * size * (side === 'BUY' ? 1 : -1) * 100) / 100;
  const now = new Date();
  const time = now.toTimeString().slice(0, 5);

  return {
    id: String(tradeIdCounter),
    time,
    symbol,
    side,
    entryPrice,
    exitPrice,
    size,
    pnl,
    status: 'FILLED',
    timestamp: now.toISOString(),
    strategy,
    regime: strategy.regime,
  };
}

/* ═══════════════════════════════════════════════════════════
   REASONING GENERATION
   ═══════════════════════════════════════════════════════════ */
let reasoningIdCounter = 100;

const REASONING_TEMPLATES: Record<string, string[]> = {
  mean_reversion: [
    "{symbol} is bouncing off **support** at ${price} with solid volume. Mean reversion play — taking a **LONG** here. Confidence: {confidence}%",
    "{symbol} hit the lower band — oversold on RSI at {rsi}. **CHoCH** confirmed. Going **LONG** with {leverage}x leverage.",
    "{symbol} extended from VWAP. Expecting a snap back — **SCALP** long with tight risk management.",
    "{symbol} mean reversion setup at ${price}. Price deviated too far from the baseline — snapping back.",
  ],
  trend_following: [
    "{symbol} broke above the 20 EMA with volume. **BOS** confirmed — riding the **trend** with a **LONG**. Confidence: {confidence}%",
    "{symbol} showing higher highs and higher lows. Trend is your friend — going **LONG** with {leverage}x.",
    "{symbol} momentum building. MACD aligned, taking the follow-through. **TREND** strategy active.",
    "{symbol} broke structure to the upside — **bullish BOS** locked in. **LONG** position opened.",
  ],
  breakout: [
    "{symbol} breaking out of consolidation with a volume spike. **BOS** confirmed — entering **LONG** on momentum. Confidence: {confidence}%",
    "{symbol} cleared **resistance** at ${price} with authority. Volatility expanding — riding the breakout.",
    "{symbol} volatility surge detected. Range break — taking the directional **LONG** bias with {leverage}x.",
    "{symbol} just broke the range high. **Breakout** strategy — quick **SCALP** to catch the momentum.",
  ],
  vwap_scalp: [
    "{symbol} reverting to VWAP after a quick deviation. **SCALP** setup — fast in, fast out.",
    "{symbol} riding the VWAP band. Quick **SCALP** long for a few ticks at ${price}.",
    "{symbol} testing VWAP as **support** in mixed conditions. Small size, tight stop — **SCALP** mode.",
    "{symbol} VWAP rejection at ${price}. Snapping back — **SCALP LONG** with {leverage}x leverage.",
  ],
};

function generateReasoning(symbol: string, strategy: StrategyInfo, price?: number, rsi?: number): ReasoningEntry {
  reasoningIdCounter++;
  const templates = REASONING_TEMPLATES[strategy.name] || REASONING_TEMPLATES.vwap_scalp;
  const template = templates[Math.floor(Math.random() * templates.length)];
  const confidence = Math.round((strategy.confidence || 0.7) * 100);
  const leverage = Math.floor(5 + Math.random() * 15);
  const priceStr = price ? price.toFixed(price > 1000 ? 0 : price > 1 ? 2 : 4) : '0';
  const rsiStr = rsi ? Math.round(rsi).toString() : '50';
  let text = template.replace(/{symbol}/g, symbol.replace('USDT', ''));
  text = text.replace(/{price}/g, priceStr);
  text = text.replace(/{confidence}/g, String(confidence));
  text = text.replace(/{leverage}/g, String(leverage));
  text = text.replace(/{rsi}/g, rsiStr);
  const now = new Date();
  const timestamp = now.toTimeString().slice(0, 8);

  return {
    id: String(reasoningIdCounter),
    timestamp,
    text,
    strategy: strategy.name,
    regime: strategy.regime,
  };
}

/* ═══════════════════════════════════════════════════════════
   MAIN HOOK
   ═══════════════════════════════════════════════════════════ */
export interface LiveTradingState {
  prices: Record<string, number>;
  histories: Record<string, number[]>;
  regimes: Record<string, string>;
  srLevels: Record<string, SRLevels>;
  strategies: Record<string, StrategyInfo>;
  trades: Trade[];
  reasoning: ReasoningEntry[];
  marketData: MarketData[];
  activePositions: Position[];
  stats: {
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnl: number;
    winRate: number;
    bestCoin: string;
    dominantStrategy: string;
    dominantRegime: string;
  };
}

const CYCLE_MS = 2000;
const MAX_TRADES = 50;
const MAX_REASONING = 20;

export function useLiveTrading(): LiveTradingState {
  const historiesRef = useRef<Record<string, number[]>>({});
  const tradesRef = useRef<Trade[]>([]);
  const reasoningRef = useRef<ReasoningEntry[]>([]);

  const [state, setState] = useState<LiveTradingState>(() => {
    const initialHistories: Record<string, number[]> = {};
    const initialRegimes: Record<string, string> = {};
    const initialSR: Record<string, SRLevels> = {};
    const initialStrategies: Record<string, StrategyInfo> = {};
    const initialMarketData: MarketData[] = [];

    COINS.forEach((coin) => {
      const history = generateSparkline(coin.price, 30);
      initialHistories[coin.symbol] = history;
      const regime = detectRegime(history);
      initialRegimes[coin.symbol] = regime;
      initialSR[coin.symbol] = generateSRLevels(coin.price, history);
      initialStrategies[coin.symbol] = pickStrategy(regime);

      const rsi = calculateRSI(history);
      const lastPrice = history[history.length - 1];
      const prevPrice = history[history.length - 8];
      const change24h = prevPrice > 0 ? ((lastPrice - prevPrice) / prevPrice) * 100 : 0;

      initialMarketData.push({
        symbol: coin.symbol,
        name: coin.name,
        price: lastPrice,
        change24h: Math.round(change24h * 100) / 100,
        rsi: Math.round(rsi),
        macd: rsi > 60 ? 'Bullish' : rsi < 40 ? 'Bearish' : 'Neutral',
        trend: change24h > 1 ? 'Uptrend' : change24h < -1 ? 'Downtrend' : 'Sideways',
        sparkline: [...history],
        regime,
        srLevels: initialSR[coin.symbol],
        volume24h: Math.round(500000000 + Math.random() * 50000000000),
      });
    });

    historiesRef.current = initialHistories;

    return {
      prices: Object.fromEntries(COINS.map((c) => [c.symbol, c.price])),
      histories: initialHistories,
      regimes: initialRegimes,
      srLevels: initialSR,
      strategies: initialStrategies,
      trades: [],
      reasoning: [],
      marketData: initialMarketData,
      activePositions: [],
      stats: {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalPnl: 0,
        winRate: 0,
        bestCoin: 'BTCUSDT',
        dominantStrategy: 'trend_following',
        dominantRegime: 'trending',
      },
    };
  });

  const cycle = useCallback(() => {
    setState((prev) => {
      const newPrices: Record<string, number> = {};
      const newHistories: Record<string, number[]> = {};
      const newRegimes: Record<string, string> = {};
      const newSR: Record<string, SRLevels> = {};
      const newStrategies: Record<string, StrategyInfo> = {};
      const newMarketData: MarketData[] = [];

      // Update each coin
      COINS.forEach((coin) => {
        const currentPrice = prev.prices[coin.symbol] || coin.price;
        const newPrice = simulatePriceMovement(currentPrice, coin.price);
        newPrices[coin.symbol] = newPrice;

        const oldHistory = prev.histories[coin.symbol] || [];
        const history = [...oldHistory.slice(-59), newPrice];
        newHistories[coin.symbol] = history;

        const regime = detectRegime(history);
        newRegimes[coin.symbol] = regime;
        newSR[coin.symbol] = generateSRLevels(newPrice, history);
        newStrategies[coin.symbol] = pickStrategy(regime);

        const rsi = calculateRSI(history);
        const prevPrice = history.length > 8 ? history[history.length - 8] : history[0];
        const change24h = prevPrice > 0 ? ((newPrice - prevPrice) / prevPrice) * 100 : 0;

        newMarketData.push({
          symbol: coin.symbol,
          name: coin.name,
          price: newPrice,
          change24h: Math.round(change24h * 100) / 100,
          rsi: Math.round(rsi),
          macd: rsi > 60 ? 'Bullish' : rsi < 40 ? 'Bearish' : 'Neutral',
          trend: change24h > 1 ? 'Uptrend' : change24h < -1 ? 'Downtrend' : 'Sideways',
          sparkline: [...history],
          regime,
          srLevels: newSR[coin.symbol],
          volume24h: prev.marketData.find((m) => m.symbol === coin.symbol)?.volume24h || 1000000000,
        });
      });

      // Maybe generate a trade (60% chance per cycle)
      let newTrades = tradesRef.current;
      let newReasoning = reasoningRef.current;

      if (Math.random() < 0.6) {
        const activeCoin = COINS[Math.floor(Math.random() * COINS.length)];
        const strategy = newStrategies[activeCoin.symbol];
        const trade = generateMockTrade(activeCoin.symbol, newPrices[activeCoin.symbol], strategy);
        newTrades = [trade, ...tradesRef.current].slice(0, MAX_TRADES);
        tradesRef.current = newTrades;

        const reasoning = generateReasoning(activeCoin.symbol, strategy, newPrices[activeCoin.symbol], newMarketData.find(m => m.symbol === activeCoin.symbol)?.rsi);
        newReasoning = [reasoning, ...reasoningRef.current].slice(0, MAX_REASONING);
        reasoningRef.current = newReasoning;
      }

      // Calculate stats
      const allTrades = newTrades;
      const wins = allTrades.filter((t) => t.pnl > 0).length;
      const losses = allTrades.filter((t) => t.pnl <= 0).length;
      const totalPnl = allTrades.reduce((sum, t) => sum + t.pnl, 0);

      // Best coin by trade count
      const coinTradeCounts: Record<string, number> = {};
      allTrades.forEach((t) => {
        coinTradeCounts[t.symbol] = (coinTradeCounts[t.symbol] || 0) + 1;
      });
      let bestCoin = 'BTCUSDT';
      let maxCount = 0;
      Object.entries(coinTradeCounts).forEach(([sym, count]) => {
        if (count > maxCount) { bestCoin = sym; maxCount = count; }
      });

      // Dominant strategy
      const strategyCounts: Record<string, number> = {};
      allTrades.forEach((t) => {
        if (t.strategy) strategyCounts[t.strategy.name] = (strategyCounts[t.strategy.name] || 0) + 1;
      });
      let dominantStrategy = 'trend_following';
      let maxStratCount = 0;
      Object.entries(strategyCounts).forEach(([s, c]) => {
        if (c > maxStratCount) { dominantStrategy = s; maxStratCount = c; }
      });

      // Dominant regime
      const regimeCounts: Record<string, number> = {};
      Object.values(newRegimes).forEach((r) => {
        regimeCounts[r] = (regimeCounts[r] || 0) + 1;
      });
      let dominantRegime = 'trending';
      let maxRegimeCount = 0;
      Object.entries(regimeCounts).forEach(([r, c]) => {
        if (c > maxRegimeCount) { dominantRegime = r; maxRegimeCount = c; }
      });

      // Build active positions from recent BUY trades
      const positionMap = new Map<string, Position>();
      allTrades.filter((t) => t.side === 'BUY' && t.pnl > 0).slice(0, 10).forEach((t) => {
        const baseSym = t.symbol.replace('USDT', '');
        if (!positionMap.has(t.symbol)) {
          positionMap.set(t.symbol, {
            symbol: baseSym,
            amount: t.size,
            value: Math.round(t.exitPrice * t.size * 100) / 100,
            entryPrice: t.entryPrice,
            currentPrice: t.exitPrice,
            pnl: t.pnl,
            sparkline: newHistories[t.symbol]?.slice(-10) || [],
            side: 'LONG',
            strategy: t.strategy,
          });
        }
      });

      return {
        prices: newPrices,
        histories: newHistories,
        regimes: newRegimes,
        srLevels: newSR,
        strategies: newStrategies,
        trades: newTrades,
        reasoning: newReasoning,
        marketData: newMarketData,
        activePositions: Array.from(positionMap.values()).slice(0, 5),
        stats: {
          totalTrades: allTrades.length,
          wins,
          losses,
          totalPnl,
          winRate: allTrades.length > 0 ? Math.round((wins / allTrades.length) * 100) : 0,
          bestCoin,
          dominantStrategy,
          dominantRegime,
        },
      };
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(cycle, CYCLE_MS);
    return () => clearInterval(interval);
  }, [cycle]);

  return state;
}

export default useLiveTrading;
