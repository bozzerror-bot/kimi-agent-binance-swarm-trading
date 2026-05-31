import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const COINS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT',
  'DOGEUSDT','ADAUSDT','AVAXUSDT','LINKUSDT','DOTUSDT',
  'MATICUSDT','LTCUSDT','UNIUSDT','ATOMUSDT','ETCUSDT',
  'FILUSDT','ARBUSDT','OPUSDT','SUIUSDT','TIAUSDT',
] as const;

export interface CoinData { symbol: string; name: string; price: number; change24h: number; high24h: number; low24h: number; volume24h: number; isReal: boolean; }
export interface Position { id: string; symbol: string; side: 'LONG' | 'SHORT'; entryPrice: number; currentPrice: number; size: number; leverage: number; margin: number; pnl: number; pnlPercent: number; stopLoss: number; takeProfit: number; strategy: string; regime: string; entryTime: string; timeframe: string; status: 'open' | 'closed'; closePrice?: number; closeTime?: string; closeReason?: string; }
export interface TradeLog { id: string; time: string; symbol: string; side: 'LONG' | 'SHORT'; price: number; size: number; leverage: number; margin: number; pnl: number; pnlPercent: number; status: 'open' | 'closed'; strategy: string; regime: string; reasoning: string; timeframe: string; closePrice?: number; closeTime?: string; closeReason?: string; }
export interface ReasoningEntry { time: string; type: 'trade' | 'close' | 'hold' | 'system'; symbol: string; strategy: string; confidence: number; text: string; }
export interface StudyCoinData { supportLevels: number[]; resistanceLevels: number[]; trendDirection: 'uptrend' | 'downtrend' | 'sideways'; trend15m: 'uptrend' | 'downtrend' | 'sideways'; trend1h: 'uptrend' | 'downtrend' | 'sideways'; volatility: number; avgVolume: number; bestTimes: string; lastUpdated: number; }
export interface StrategyStat { wins: number; losses: number; totalPnl: number; winRate: number; }

interface State {
  coins: CoinData[]; priceHistory: Record<string, number[]>; isRunning: boolean; cycle: number;
  positions: Position[]; trades: TradeLog[]; reasoning: ReasoningEntry[]; pnlHistory: { date: string; pnl: number }[];
  mood: string; stressLevel: number; streak: number; totalPnl: number; winCount: number; lossCount: number;
  marketStudyComplete: boolean; marketStudyProgress: number; marketStudyData: Record<string, StudyCoinData>;
  strategyStats: Record<string, StrategyStat>;
  settings: { name: string; riskTolerance: number; confidence: number; patience: number; adaptability: number; maxLeverage: number; selectedCoins: string[]; interval: string; tradingEnabled: boolean; apiKey: string; apiSecret: string; entrySize: number; };
  setCoins: (c: CoinData[]) => void; updatePrice: (sym: string, p: number, ch: number) => void; addPriceHistory: (sym: string, p: number) => void;
  addPosition: (pos: Position) => void; closePosition: (id: string, cp: number, reason: string) => void; updatePositionPrices: (prices: Record<string, number>) => void;
  addTrade: (t: TradeLog) => void; addReasoning: (r: ReasoningEntry) => void; updateSettings: (p: Partial<State['settings']>) => void;
  setMood: (m: string) => void; setStress: (s: number) => void; setMarketStudyComplete: (d: boolean) => void; setMarketStudyProgress: (p: number) => void; setMarketStudyData: (d: Record<string, StudyCoinData>) => void; incrementCycle: () => void; resetAll: () => void;
}

const defCoins: CoinData[] = COINS.map(s => ({ symbol: s, name: s.replace('USDT',''), price: 0, change24h: 0, high24h: 0, low24h: 0, volume24h: 0, isReal: false }));
const defStats: Record<string, StrategyStat> = { BOS: {wins:0,losses:0,totalPnl:0,winRate:0}, CHoCH: {wins:0,losses:0,totalPnl:0,winRate:0}, TREND: {wins:0,losses:0,totalPnl:0,winRate:0}, SCALP: {wins:0,losses:0,totalPnl:0,winRate:0} };

export const useAlexStore = create<State>()(persist((set) => ({
  coins: defCoins, priceHistory: {}, isRunning: true, cycle: 0, positions: [], trades: [], reasoning: [], pnlHistory: [],
  mood: 'neutral', stressLevel: 0, streak: 0, totalPnl: 0, winCount: 0, lossCount: 0,
  marketStudyComplete: false, marketStudyProgress: 0, marketStudyData: {}, strategyStats: defStats,
  settings: { name: 'Alex', riskTolerance: 72, confidence: 65, patience: 40, adaptability: 85, maxLeverage: 20, selectedCoins: [...COINS], interval: '15m', tradingEnabled: false, apiKey: '', apiSecret: '', entrySize: 100 },

  setCoins: (c) => set({ coins: c }),
  updatePrice: (sym, p, ch) => set(s => ({ coins: s.coins.map(c => c.symbol === sym ? { ...c, price: p, change24h: ch, isReal: true } : c) })),
  addPriceHistory: (sym, p) => set(s => { const h = [...(s.priceHistory[sym] || []), p]; if (h.length > 200) h.shift(); return { priceHistory: { ...s.priceHistory, [sym]: h } }; }),
  addPosition: (pos) => set(s => ({ positions: [...s.positions, pos] })),
  closePosition: (id, cp, reason) => set(s => {
    const pos = s.positions.find(p => p.id === id); if (!pos) return s;
    const pnl = (cp - pos.entryPrice) * pos.size * (pos.side === 'LONG' ? 1 : -1);
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
    const last = s.pnlHistory[s.pnlHistory.length - 1];
    const newHist = last && last.date === today ? [...s.pnlHistory.slice(0, -1), { ...last, pnl: last.pnl + pnl }] : [...s.pnlHistory, { date: today, pnl }];
    const st = s.strategyStats[pos.strategy] || {wins:0,losses:0,totalPnl:0,winRate:0};
    const wins = pnl > 0 ? st.wins + 1 : st.wins; const losses = pnl < 0 ? st.losses + 1 : st.losses; const total = wins + losses;
    return { positions: s.positions.filter(p => p.id !== id), totalPnl: s.totalPnl + pnl, pnlHistory: newHist,
      trades: s.trades.map(t => t.id === id ? { ...t, status: 'closed' as const, closePrice: cp, closeTime: new Date().toLocaleTimeString('en-US', { hour12: false }), closeReason: reason, pnl } : t),
      winCount: pnl > 0 ? s.winCount + 1 : s.winCount, lossCount: pnl < 0 ? s.lossCount + 1 : s.lossCount,
      strategyStats: { ...s.strategyStats, [pos.strategy]: { wins, losses, totalPnl: st.totalPnl + pnl, winRate: total > 0 ? Math.round((wins/total)*100) : 0 } } };
  }),
  updatePositionPrices: (prices) => set(s => ({ positions: s.positions.map(p => { const c = prices[p.symbol] || p.currentPrice; const pnl = (c - p.entryPrice) * p.size * (p.side === 'LONG' ? 1 : -1); return { ...p, currentPrice: c, pnl, pnlPercent: (pnl / p.margin) * 100 }; }) })),
  addTrade: (t) => set(s => ({ trades: [t, ...s.trades] })),
  addReasoning: (r) => set(s => ({ reasoning: [r, ...s.reasoning].slice(0, 50) })),
  updateSettings: (p) => set(s => ({ settings: { ...s.settings, ...p } })),
  setMood: (m) => set({ mood: m }),
  setStress: (v) => set({ stressLevel: v }),
  setMarketStudyComplete: (d) => set({ marketStudyComplete: d }),
  setMarketStudyProgress: (p) => set({ marketStudyProgress: p }),
  setMarketStudyData: (d) => set({ marketStudyData: d }),
  incrementCycle: () => set(s => ({ cycle: s.cycle + 1 })),
  resetAll: () => { localStorage.removeItem('alex-v6'); set({ coins: defCoins, priceHistory: {}, isRunning: true, cycle: 0, positions: [], trades: [], reasoning: [], pnlHistory: [], mood: 'neutral', stressLevel: 0, streak: 0, totalPnl: 0, winCount: 0, lossCount: 0, marketStudyComplete: false, marketStudyProgress: 0, marketStudyData: {}, strategyStats: defStats, settings: { name: 'Alex', riskTolerance: 72, confidence: 65, patience: 40, adaptability: 85, maxLeverage: 20, selectedCoins: [...COINS], interval: '15m', tradingEnabled: false, apiKey: '', apiSecret: '', entrySize: 100 } }); },
}), { name: 'alex-v6', partialize: s => ({ settings: s.settings, positions: s.positions, trades: s.trades, pnlHistory: s.pnlHistory, mood: s.mood, stressLevel: s.stressLevel, streak: s.streak, totalPnl: s.totalPnl, winCount: s.winCount, lossCount: s.lossCount, cycle: s.cycle, marketStudyComplete: s.marketStudyComplete, marketStudyProgress: s.marketStudyProgress, marketStudyData: s.marketStudyData, strategyStats: s.strategyStats }) }));
