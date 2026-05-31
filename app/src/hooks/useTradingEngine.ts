import { useEffect, useRef } from 'react';
import { useAlexStore, type StudyCoinData } from '@/store/useAlexStore';
const FAPI = 'https://fapi.binance.com/fapi/v1';
let posId = 1;
interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number; }
async function fetchKlines(symbol: string, interval: string, limit: number): Promise<Candle[]> {
  try { const res = await fetch(`${FAPI}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`); const data = await res.json(); return (data as string[][]).map(c => ({ time: parseInt(c[0]), open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5]) })); } catch { return []; }
}
function ema(prices: number[], period: number): number { if (prices.length < period) return prices[prices.length - 1] || 0; const m = 2 / (period + 1); let e = prices.slice(0, period).reduce((a, b) => a + b, 0) / period; for (let i = period; i < prices.length; i++) e = (prices[i] - e) * m + e; return e; }
function calcTrend(closes: number[]): 'uptrend' | 'downtrend' | 'sideways' { if (closes.length < 50) return 'sideways'; const e9 = ema(closes, 9), e20 = ema(closes, 20), e50 = ema(closes, 50); const p = closes[closes.length - 1]; if (p > e9 && e9 > e20 && e20 > e50) return 'uptrend'; if (p < e9 && e9 < e20 && e20 < e50) return 'downtrend'; return 'sideways'; }
function detectBOS(candles: Candle[]): { type: 'bullish' | 'bearish' | null; strength: number } { if (candles.length < 20) return { type: null, strength: 0 }; const c = candles; const mid = Math.floor(c.length / 2); const lh = Math.max(...c.slice(0, mid).map(x => x.high)); const ll = Math.min(...c.slice(0, mid).map(x => x.low)); const last = c[c.length - 1]; if (last.close > lh * 1.0015) return { type: 'bullish', strength: 0.35 }; if (last.close < ll * 0.9985) return { type: 'bearish', strength: 0.35 }; return { type: null, strength: 0 }; }
function detectCHoCH(candles: Candle[]): { type: 'bullish' | 'bearish' | null; strength: number } { if (candles.length < 30) return { type: null, strength: 0 }; const highs: number[] = [], lows: number[] = []; const c = candles; for (let i = 2; i < c.length - 2; i++) { if (c[i].high > c[i-1].high && c[i].high > c[i-2].high && c[i].high > c[i+1].high && c[i].high > c[i+2].high) highs.push(c[i].high); if (c[i].low < c[i-1].low && c[i].low < c[i-2].low && c[i].low < c[i+1].low && c[i].low < c[i+2].low) lows.push(c[i].low); } if (highs.length < 2 || lows.length < 2) return { type: null, strength: 0 }; const hh = highs[highs.length - 1] > highs[highs.length - 2]; const ll = lows[lows.length - 1] < lows[lows.length - 2]; if (hh && ll) return { type: 'bearish', strength: 0.35 }; const hl = highs[highs.length - 1] < highs[highs.length - 2]; const lh2 = lows[lows.length - 1] > lows[lows.length - 2]; if (hl && lh2) return { type: 'bullish', strength: 0.35 }; return { type: null, strength: 0 }; }
function calcConf(candles15m: Candle[], candles1h: Candle[], study: StudyCoinData | undefined, side: 'LONG' | 'SHORT', stress: number, stratStats: Record<string, { winRate: number }>): { confidence: number; strategy: string; sr: { sl: number; tp: number } } {
  let score = 0; const c15 = candles15m.map(c => c.close); const lp = c15[c15.length - 1] || 0;
  const bos = detectBOS(candles15m); if (bos.type) score += bos.strength;
  const choch = detectCHoCH(candles15m); if (choch.type) score += choch.strength;
  const trend15m = calcTrend(c15); const trend1h = candles1h.length > 50 ? calcTrend(candles1h.map(c => c.close)) : trend15m;
  let strategy = choch.type ? 'CHoCH' : bos.type ? 'BOS' : 'SCALP';
  if (!bos.type && !choch.type && trend15m !== 'sideways') { const ts: 'LONG' | 'SHORT' = trend15m === 'uptrend' ? 'LONG' : 'SHORT'; if (ts === side) { score += 0.25; strategy = 'TREND'; } } else if (trend15m !== 'sideways') { const ts: 'LONG' | 'SHORT' = trend15m === 'uptrend' ? 'LONG' : 'SHORT'; if (ts === ((choch.type === 'bullish' || bos.type === 'bullish') ? 'LONG' : 'SHORT')) score += 0.25; }
  if (c15.length >= 20) { const e9 = ema(c15, 9), e20 = ema(c15, 20); if (e9 > e20 && side === 'LONG') score += 0.15; else if (e9 < e20 && side === 'SHORT') score += 0.15; }
  if (c15.length >= 10) { const ch = (c15[c15.length - 1] - c15[c15.length - 10]) / c15[c15.length - 10]; if (Math.abs(ch) > 0.008) score += 0.1; }
  const vol = candles15m.slice(-14).reduce((s, c) => s + (c.high - c.low), 0) / 14; if (vol / lp > 0.002) score += 0.1;
  if (study) { if ((study.trendDirection === 'uptrend' || study.trend1h === 'uptrend') && side === 'LONG') score += 0.15; else if ((study.trendDirection === 'downtrend' || study.trend1h === 'downtrend') && side === 'SHORT') score += 0.15; }
  const swr = stratStats[strategy]?.winRate || 0; if (swr > 60) score += 0.1; else if (swr > 50) score += 0.05;
  if (trend15m !== 'sideways' && trend1h !== 'sideways' && trend15m === trend1h) score += 0.1;
  score -= stress * 0.2;
  const confidence = Math.max(0, Math.min(1, score));
  let sl = side === 'LONG' ? lp * 0.985 : lp * 1.015; let tp = side === 'LONG' ? lp * 1.025 : lp * 0.975;
  if (study && lp > 0) { const sup = study.supportLevels[0] || 0; const res = study.resistanceLevels[0] || 0; if (side === 'LONG' && sup > 0) { sl = Math.min(sl, sup * 0.995); if (res > lp) tp = res * 0.998; } else if (side === 'SHORT' && res > 0) { sl = Math.max(sl, res * 1.005); if (sup > 0 && sup < lp) tp = sup * 1.002; } }
  return { confidence, strategy, sr: { sl: Math.round(sl * 100) / 100, tp: Math.round(tp * 100) / 100 } };
}
function getSizing(conf: number): { margin: number; lev: number } { if (conf >= 0.95) return { margin: 200, lev: 20 }; if (conf >= 0.85) return { margin: 150, lev: 15 }; if (conf >= 0.70) return { margin: 100, lev: 10 }; return { margin: 0, lev: 0 }; }
const HUMAN_MSGS: Record<string, string[]> = {
  'CHoCH_bullish_LONG': ["I'm seeing a **bullish CHoCH** on {sym} — structure just shifted. Going **LONG** with {lev}x at the {tf}.","**{sym}** trend is reversing — **bullish CHoCH** confirmed. Taking **LONG**. Conf: {conf}%"],
  'CHoCH_bearish_SHORT': ["**Bearish CHoCH** on {sym} — structure breaking down. **SHORT** with {lev}x.","**{sym}** reversing lower — **CHoCH bearish** locked in. Quick **SHORT**."],
  'BOS_bullish_LONG': ["**Bullish BOS** on {sym} — broke previous high. **LONG** with {lev}x.","{sym} smashed resistance — **BOS signal**. Riding **LONG**."],
  'BOS_bearish_SHORT': ["**Bearish BOS** on {sym} — broke lows. **SHORT** with {lev}x.","{sym} breaking down — **BOS confirmed**. **SHORT** position."],
  'TREND_LONG': ["{sym} clean **uptrend** on 15m + 1h. **LONG** on EMA pullback with {lev}x.","Trend is my friend on **{sym}** — both TF bullish. **LONG**."],
  'TREND_SHORT': ["**{sym}** downtrend on 15m + 1h. **SHORT** at resistance with {lev}x.","Bear trend on {sym}. **SHORT** with {lev}x."],
  'SCALP_LONG': ["Quick momentum on **{sym}** — **LONG** scalp with {lev}x at {tf}.","{sym} bullish momentum. Quick in-and-out **LONG**."],
  'SCALP_SHORT': ["Fast **SHORT** scalp on **{sym}** — momentum shifting bearish. {lev}x.","{sym} dropping. Quick **SHORT** scalp."],
};
function humanR(_strategy: string, chochType: string | null, bosType: string | null, trend: string, sym: string, lev: number, conf: number, tf: string): string {
  const s = sym.replace('USDT', '');
  const key = chochType ? `CHoCH_${chochType}_${chochType === 'bullish' ? 'LONG' : 'SHORT'}` : bosType ? `BOS_${bosType}_${bosType === 'bullish' ? 'LONG' : 'SHORT'}` : trend !== 'sideways' ? `TREND_${trend === 'uptrend' ? 'LONG' : 'SHORT'}` : `SCALP_${Math.random() > 0.5 ? 'LONG' : 'SHORT'}`;
  const msgs = HUMAN_MSGS[key] || HUMAN_MSGS.SCALP_LONG;
  return msgs[Math.floor(Math.random() * msgs.length)].replace('{sym}', s).replace('{lev}', String(lev)).replace('{conf}', String(Math.round(conf * 100))).replace('{tf}', tf);
}
export function useTradingEngine() {
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  const cache = useRef<Record<string, { m15: Candle[]; h1: Candle[]; ts: number }>>({});
  useEffect(() => {
    const cycle = async () => {
      const store = useAlexStore.getState();
      const { coins, settings, positions, stressLevel, marketStudyComplete, marketStudyData, strategyStats, addPosition, addTrade, addReasoning, closePosition, updatePositionPrices, incrementCycle, setMood, setStress } = store;
      incrementCycle();
      const priceMap: Record<string, number> = {}; for (const c of coins) priceMap[c.symbol] = c.price;
      updatePositionPrices(priceMap);
      for (const pos of positions) {
        if (pos.status !== 'open') continue;
        const cur = priceMap[pos.symbol] || pos.currentPrice;
        const study = marketStudyData[pos.symbol];
        let dsl = pos.stopLoss, dtp = pos.takeProfit;
        if (study) { if (pos.side === 'LONG') { const sup = study.supportLevels[0]; if (sup > 0 && sup < pos.entryPrice) dsl = sup * 0.997; const res = study.resistanceLevels[0]; if (res > 0 && res > pos.entryPrice) dtp = res * 0.998; } else { const res = study.resistanceLevels[0]; if (res > 0 && res > pos.entryPrice) dsl = res * 1.003; const sup = study.supportLevels[0]; if (sup > 0 && sup < pos.entryPrice) dtp = sup * 1.002; } }
        if (pos.side === 'LONG') { if (cur <= dsl) { closePosition(pos.id, cur, 'stop_loss'); continue; } if (cur >= dtp) { closePosition(pos.id, cur, 'take_profit'); continue; } }
        else { if (cur >= dsl) { closePosition(pos.id, cur, 'stop_loss'); continue; } if (cur <= dtp) { closePosition(pos.id, cur, 'take_profit'); continue; } }
      }
      if (!marketStudyComplete) return;
      const now = Date.now();
      const patienceThreshold = (settings.patience ?? 40) / 100;
      if (Math.random() > patienceThreshold) return;
      if (!settings.tradingEnabled || positions.filter(p => p.status === 'open').length >= 5) return;
      const candidates = coins.filter(c => settings.selectedCoins.includes(c.symbol) && c.price > 0 && !positions.some(p => p.symbol === c.symbol && p.status === 'open')).slice(0, 5);
      for (const coin of candidates) {
        const sym = coin.symbol;
        const cached = cache.current[sym];
        let m15: Candle[], h1: Candle[];
        if (cached && now - cached.ts < 30000) { m15 = cached.m15; h1 = cached.h1; }
        else { [m15, h1] = await Promise.all([fetchKlines(sym, settings.interval || '15m', 60), fetchKlines(sym, '1h', 50)]); cache.current[sym] = { m15, h1, ts: now }; }
        if (m15.length < 30) continue;
        const bos = detectBOS(m15); const choch = detectCHoCH(m15); const trend = calcTrend(m15.map(c => c.close));
        const side: 'LONG' | 'SHORT' = (choch.type === 'bullish' || bos.type === 'bullish' || (trend === 'uptrend' && !bos.type && !choch.type)) ? 'LONG' : 'SHORT';
        const study = marketStudyData[sym];
        const { confidence, strategy, sr } = calcConf(m15, h1, study, side, stressLevel, strategyStats);
        if (confidence < 0.70) continue;
        const { margin, lev } = getSizing(confidence); if (lev === 0) continue;
        const price = coin.price; const size = Math.round((margin * lev / price) * 10000) / 10000;
        const tf = settings.interval || '15m'; const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false });
        const pos = { id: `pos-${posId++}`, symbol: sym, side, entryPrice: price, currentPrice: price, size, leverage: lev, margin, pnl: 0, pnlPercent: 0, stopLoss: sr.sl, takeProfit: sr.tp, strategy, regime: trend === 'uptrend' ? 'trending' : trend === 'downtrend' ? 'downtrending' : 'ranging', entryTime: nowStr, timeframe: tf, status: 'open' as const };
        addPosition(pos); addTrade({ ...pos, time: nowStr, price, reasoning: `${strategy}: confidence ${(confidence * 100).toFixed(0)}%`, timeframe: tf });
        addReasoning({ time: nowStr, type: 'trade', symbol: sym, strategy, confidence, text: humanR(strategy, choch.type, bos.type, trend, sym, lev, confidence, tf) });
        setMood('focused'); setStress(Math.max(0, stressLevel - 0.05)); break;
      }
    };
    iv.current = setInterval(cycle, 8000);
    return () => { if (iv.current) clearInterval(iv.current); };
  }, []);
}
