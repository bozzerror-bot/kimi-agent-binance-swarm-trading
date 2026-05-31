import { useEffect, useRef } from 'react';
import { useAlexStore } from '@/store/useAlexStore';

let posId = 1;

/* ═══════════════════════════════════════════════════════════
   Technical Indicator Helpers
   ═══════════════════════════════════════════════════════════ */

function ema(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const mult = 2 / (period + 1);
  let e = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) e = (prices[i] - e) * mult + e;
  return e;
}

/* ═══════════════════════════════════════════════════════════
   Market Structure Detection — BOS / CHoCH
   ═══════════════════════════════════════════════════════════ */

function detectBOS(history: number[]): { type: 'bullish' | 'bearish' | null; strength: number } {
  if (history.length < 20) return { type: null, strength: 0 };
  const recent = history.slice(-20);
  const mid = Math.floor(recent.length / 2);
  const leftHigh = Math.max(...recent.slice(0, mid));
  const leftLow = Math.min(...recent.slice(0, mid));
  const lastPrice = recent[recent.length - 1];
  if (lastPrice > leftHigh * 1.002) return { type: 'bullish', strength: 0.35 };
  if (lastPrice < leftLow * 0.998) return { type: 'bearish', strength: 0.35 };
  return { type: null, strength: 0 };
}

function detectCHoCH(history: number[]): { type: 'bullish' | 'bearish' | null; strength: number } {
  if (history.length < 30) return { type: null, strength: 0 };
  const recent = history.slice(-30);
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i] > recent[i-1] && recent[i] > recent[i-2] && recent[i] > recent[i+1] && recent[i] > recent[i+2]) highs.push(recent[i]);
    if (recent[i] < recent[i-1] && recent[i] < recent[i-2] && recent[i] < recent[i+1] && recent[i] < recent[i+2]) lows.push(recent[i]);
  }
  if (highs.length < 2 || lows.length < 2) return { type: null, strength: 0 };
  const hh = highs[highs.length - 1] > highs[highs.length - 2];
  const ll = lows[lows.length - 1] < lows[lows.length - 2];
  if (hh && ll) return { type: 'bearish', strength: 0.35 };
  const hl = highs[highs.length - 1] < highs[highs.length - 2];
  const lh = lows[lows.length - 1] > lows[lows.length - 2];
  if (hl && lh) return { type: 'bullish', strength: 0.35 };
  return { type: null, strength: 0 };
}

/* ═══════════════════════════════════════════════════════════
   Market Study Types
   ═══════════════════════════════════════════════════════════ */

interface MarketStudyEntry {
  trendDirection: 'uptrend' | 'downtrend' | 'sideways' | 'ranging';
  support: number;
  resistance: number;
  volatility: number;
  srLevels?: { support: number; resistance: number };
  regime?: string;
}

type MarketStudyData = Record<string, MarketStudyEntry>;

/* ═══════════════════════════════════════════════════════════
   Enhanced Confidence Calculator — integrates Market Study
   ═══════════════════════════════════════════════════════════ */

function calcConfidence(
  history: number[],
  stress: number,
  marketStudyData: MarketStudyData,
  symbol: string,
  side: 'LONG' | 'SHORT'
): number {
  let score = 0;

  /* 1. Base structure signals */
  const bos = detectBOS(history);
  const choch = detectCHoCH(history);
  if (bos.type) score += bos.strength;
  if (choch.type) score += choch.strength;

  /* 2. EMA alignment */
  const e9 = ema(history, 9);
  const e20 = ema(history, 20);
  if (e9 > e20) score += 0.15;

  /* 3. Recent momentum */
  const change = (history[history.length - 1] - history[history.length - 10]) / history[history.length - 10];
  if (Math.abs(change) > 0.01) score += 0.1;

  /* 4. Volatility regime */
  const atr = Math.max(...history.slice(-20)) - Math.min(...history.slice(-20));
  const atrPct = atr / history[history.length - 1];
  if (atrPct > 0.02) score += 0.1;

  /* 5. Stress penalty */
  score -= stress * 0.2;

  /* 6. Market Study — Trend Alignment */
  const study = marketStudyData[symbol];
  if (study) {
    const trendDir = study.trendDirection;
    const trendUp = trendDir === 'uptrend' || trendDir === 'ranging';
    const trendDown = trendDir === 'downtrend' || trendDir === 'sideways';

    // +0.15 if trend aligns with trade direction
    if (side === 'LONG' && trendUp) score += 0.15;
    else if (side === 'SHORT' && trendDown) score += 0.15;
    // -0.05 penalty on mismatch
    else if (side === 'LONG' && trendDown) score -= 0.05;
    else if (side === 'SHORT' && trendUp) score -= 0.05;

    /* 7. Market Study — S/R Proximity Check */
    const support = study.support ?? (study.srLevels?.support ?? 0);
    const resistance = study.resistance ?? (study.srLevels?.resistance ?? 0);
    const currentPrice = history[history.length - 1];

    if (support > 0 && resistance > 0) {
      const distToSupport = Math.abs(currentPrice - support) / currentPrice;
      const distToResistance = Math.abs(currentPrice - resistance) / currentPrice;

      if (side === 'LONG') {
        // GOOD: price near support (within 0.5%)
        if (distToSupport <= 0.005) score += 0.1;
        // BAD: price right at resistance — skip trade
        if (distToResistance <= 0.005) return 0;
      } else if (side === 'SHORT') {
        // GOOD: price near resistance (within 0.5%)
        if (distToResistance <= 0.005) score += 0.1;
        // BAD: price right at support — skip trade
        if (distToSupport <= 0.005) return 0;
      }
    }

    /* 8. Market Study — Volatility bonus (having data is good) */
    if (study.volatility > 0) score += 0.05;
  }

  return Math.max(0, Math.min(1, score));
}

/* ═══════════════════════════════════════════════════════════
   Leverage Selector
   ═══════════════════════════════════════════════════════════ */

function getLeverage(confidence: number, maxLev: number): number {
  if (confidence >= 0.9) return Math.min(20, maxLev);
  if (confidence >= 0.8) return Math.min(15, maxLev);
  if (confidence >= 0.7) return Math.min(10, maxLev);
  return 0;
}

/* ═══════════════════════════════════════════════════════════
   Enhanced Trading Engine Hook
   ═══════════════════════════════════════════════════════════ */

export function useTradingEngine() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const cycle = () => {
      const store = useAlexStore.getState();
      const {
        coins,
        priceHistory,
        settings,
        positions,
        stressLevel,
        marketStudyComplete,
        marketStudyData,
        addPosition,
        addTrade,
        addReasoning,
        closePosition,
        updatePositionPrices,
        incrementCycle,
        setMood,
        setStress,
        recordStrategyResult,
      } = store;

      incrementCycle();

      /* ── Update position mark-to-market ── */
      const priceMap: Record<string, number> = {};
      for (const c of coins) priceMap[c.symbol] = c.price;
      updatePositionPrices(priceMap);

      /* ── Position management: stop-loss / take-profit ── */
      for (const pos of positions) {
        if (pos.status !== 'open') continue;
        const cur = priceMap[pos.symbol] || pos.currentPrice;
        if (pos.side === 'LONG') {
          if (cur <= pos.stopLoss) {
            const pnl = Math.round((cur - pos.entryPrice) * pos.size * 100) / 100;
            recordStrategyResult(pos.strategy, pnl);
            closePosition(pos.id, cur, 'stop_loss');
            continue;
          }
          if (cur >= pos.takeProfit) {
            const pnl = Math.round((cur - pos.entryPrice) * pos.size * 100) / 100;
            recordStrategyResult(pos.strategy, pnl);
            closePosition(pos.id, cur, 'take_profit');
            continue;
          }
        } else {
          /* SHORT: SL above entry, TP below entry */
          if (cur >= pos.stopLoss) {
            const pnl = Math.round((pos.entryPrice - cur) * pos.size * 100) / 100;
            recordStrategyResult(pos.strategy, pnl);
            closePosition(pos.id, cur, 'stop_loss');
            continue;
          }
          if (cur <= pos.takeProfit) {
            const pnl = Math.round((pos.entryPrice - cur) * pos.size * 100) / 100;
            recordStrategyResult(pos.strategy, pnl);
            closePosition(pos.id, cur, 'take_profit');
            continue;
          }
        }
      }

      /* ── Market study gate ── */
      if (!marketStudyComplete) return;

      /* ── Patience gate: high patience = trade LESS frequently ── */
      const patienceThreshold = (settings.patience ?? 40) / 100;
      if (Math.random() > patienceThreshold) return;

      /* ── Max open positions guard ── */
      if (!settings.tradingEnabled || positions.filter(p => p.status === 'open').length >= 5) return;

      /* ── Trade scanning ── */
      for (const coin of coins) {
        if (!settings.selectedCoins.includes(coin.symbol)) continue;
        if (positions.some(p => p.symbol === coin.symbol && p.status === 'open')) continue;

        const hist = priceHistory[coin.symbol];
        if (!hist || hist.length < 30) continue;

        const bos = detectBOS(hist);
        const choch = detectCHoCH(hist);
        const strategy = choch.type ? 'CHoCH' : bos.type ? 'BOS' : 'SCALP';
        const side: 'LONG' | 'SHORT' = (choch.type === 'bullish' || bos.type === 'bullish') ? 'LONG' : 'SHORT';

        /* Enhanced confidence with market study data */
        const conf = calcConfidence(hist, stressLevel, marketStudyData, coin.symbol, side);
        const lev = getLeverage(conf, settings.maxLeverage);
        if (lev === 0) continue;

        const price = coin.price;
        const margin = 100; // Fixed $100 USDT per trade
        const size = Math.round((margin * lev / price) * 10000) / 10000;
        const sl = side === 'LONG'
          ? Math.round(price * 0.985 * 100) / 100
          : Math.round(price * 1.015 * 100) / 100;
        const tp = side === 'LONG'
          ? Math.round(price * 1.03 * 100) / 100
          : Math.round(price * 0.97 * 100) / 100;
        const now = new Date().toLocaleTimeString('en-US', { hour12: false });
        const timeframe = settings.interval;

        const pos = {
          id: `pos-${posId++}`,
          symbol: coin.symbol,
          side,
          entryPrice: price,
          currentPrice: price,
          size,
          leverage: lev,
          margin,
          pnl: 0,
          pnlPercent: 0,
          stopLoss: sl,
          takeProfit: tp,
          strategy,
          regime: bos.type ? 'trending' : choch.type ? 'reversing' : 'mixed',
          entryTime: now,
          status: 'open' as const,
          timeframe,
        };

        addPosition(pos);
        addTrade({
          ...pos,
          time: now,
          price,
          reasoning: `${strategy}: confidence ${(conf * 100).toFixed(0)}%`,
        });

        const reasonText = choch.type
          ? `${coin.symbol}: CHoCH ${choch.type} — trend reversal. ${side} with ${lev}x lev. Conf: ${(conf * 100).toFixed(0)}%`
          : bos.type
            ? `${coin.symbol}: BOS ${bos.type} — structure break. ${side} with ${lev}x lev. Conf: ${(conf * 100).toFixed(0)}%`
            : `${coin.symbol}: Scalp ${side} with ${lev}x lev.`;

        addReasoning({
          time: now,
          type: 'trade',
          symbol: coin.symbol,
          strategy,
          text: reasonText,
        });

        setMood('focused');
        setStress(Math.max(0, stressLevel - 0.05));
        break;
      }
    };

    intervalRef.current = setInterval(cycle, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
