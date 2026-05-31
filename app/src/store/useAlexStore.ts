import { create } from 'zustand';
import { persist } from 'zustand/middleware';
/* Position shape is defined locally below to avoid coupling */

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

export type SMCSide = 'LONG' | 'SHORT';
export type SMCStrategy = 'BOS' | 'CHoCH' | 'TREND' | 'SCALP';

export interface AlexPosition {
  id: string;
  symbol: string;
  side: SMCSide;
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number;
  takeProfit: number;
  strategy: string;
  regime: string;
  entryTime: string;
  status: 'open' | 'closed';
  timeframe: string;
  closePrice?: number;
  closeReason?: string;
}

export interface AlexTrade {
  id: string;
  symbol: string;
  side: SMCSide;
  entryPrice: number;
  currentPrice: number;
  size: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number;
  takeProfit: number;
  strategy: string;
  regime: string;
  entryTime: string;
  status: 'open' | 'closed';
  timeframe: string;
  time: string;
  price: number;
  reasoning?: string;
  confidence?: number;
}

export interface ReasoningLog {
  time: string;
  type: string;
  symbol: string;
  strategy: string;
  text: string;
}

export interface CoinInfo {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  isReal: boolean;
}

export interface MarketStudyEntry {
  trendDirection: 'uptrend' | 'downtrend' | 'sideways' | 'ranging';
  support: number;
  resistance: number;
  volatility: number;
  srLevels?: { support: number; resistance: number };
  regime?: string;
}

export interface AlexSettings {
  selectedCoins: string[];
  maxLeverage: number;
  patience: number;
  interval: string;
  tradingEnabled: boolean;
  entrySize: number;
  maxPositions: number;
  stopLossPercent: number;
  takeProfitPercent: number;
}

export interface StrategyStat {
  wins: number;
  losses: number;
  totalPnl: number;
  winRate: number;
}

export interface AlexState {
  /* ── Data ── */
  coins: CoinInfo[];
  priceHistory: Record<string, number[]>;
  settings: AlexSettings;
  positions: AlexPosition[];
  trades: AlexTrade[];
  reasoning: ReasoningLog[];
  stressLevel: number;
  mood: string;
  cycleCount: number;
  marketStudyComplete: boolean;
  marketStudyData: Record<string, MarketStudyEntry>;
  strategyStats: Record<string, StrategyStat>;

  /* ── Actions ── */
  setCoins: (coins: CoinInfo[]) => void;
  addPriceHistory: (symbol: string, price: number) => void;
  setSettings: (settings: Partial<AlexSettings>) => void;
  addPosition: (pos: AlexPosition) => void;
  addTrade: (trade: AlexTrade) => void;
  addReasoning: (entry: ReasoningLog) => void;
  closePosition: (id: string, price: number, reason: string) => void;
  updatePositionPrices: (priceMap: Record<string, number>) => void;
  incrementCycle: () => void;
  setMood: (mood: string) => void;
  setStress: (stress: number) => void;
  setMarketStudyComplete: (complete: boolean) => void;
  setMarketStudyData: (data: Record<string, MarketStudyEntry>) => void;
  recordStrategyResult: (strategy: string, pnl: number) => void;
  setPositions: (positions: AlexPosition[]) => void;
}

/* ═══════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════ */

function getStrategyKey(strategy: string): string {
  const s = strategy?.toUpperCase() || 'UNKNOWN';
  if (s.includes('BOS')) return 'BOS';
  if (s.includes('CHOC')) return 'CHoCH';
  if (s.includes('SCALP')) return 'SCALP';
  if (s.includes('TREND')) return 'TREND';
  return s;
}

/* ═══════════════════════════════════════════════════════════
   Store
   ═══════════════════════════════════════════════════════════ */

export const useAlexStore = create<AlexState>()(
  persist(
    (set) => ({
      /* ── Initial state ── */
      coins: [],
      priceHistory: {},
      settings: {
        selectedCoins: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'],
        maxLeverage: 10,
        patience: 40,
        interval: '15m',
        tradingEnabled: false,
        entrySize: 100,
        maxPositions: 5,
        stopLossPercent: 1.5,
        takeProfitPercent: 3,
      },
      positions: [],
      trades: [],
      reasoning: [],
      stressLevel: 0,
      mood: 'neutral',
      cycleCount: 0,
      marketStudyComplete: false,
      marketStudyData: {},
      strategyStats: {
        BOS: { wins: 0, losses: 0, totalPnl: 0, winRate: 0 },
        CHoCH: { wins: 0, losses: 0, totalPnl: 0, winRate: 0 },
        SCALP: { wins: 0, losses: 0, totalPnl: 0, winRate: 0 },
        TREND: { wins: 0, losses: 0, totalPnl: 0, winRate: 0 },
      },

      /* ── Actions ── */
      setCoins: (coins) => set({ coins }),

      addPriceHistory: (symbol, price) =>
        set((state) => ({
          priceHistory: {
            ...state.priceHistory,
            [symbol]: [...(state.priceHistory[symbol] || []).slice(-499), price],
          },
        })),

      setSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),

      addPosition: (pos) =>
        set((state) => ({
          positions: [pos, ...state.positions].slice(0, 100),
        })),

      addTrade: (trade) =>
        set((state) => ({
          trades: [trade, ...state.trades].slice(0, 200),
        })),

      addReasoning: (entry) =>
        set((state) => ({
          reasoning: [entry, ...state.reasoning].slice(0, 500),
        })),

      closePosition: (id, price, reason) =>
        set((state) => {
          const pos = state.positions.find((p) => p.id === id && p.status === 'open');
          if (!pos) return {};

          const pnl =
            pos.side === 'LONG'
              ? Math.round((price - pos.entryPrice) * pos.size * 100) / 100
              : Math.round((pos.entryPrice - price) * pos.size * 100) / 100;

          const pnlPercent =
            pos.side === 'LONG'
              ? Math.round(((price - pos.entryPrice) / pos.entryPrice) * 100 * 100) / 100
              : Math.round(((pos.entryPrice - price) / pos.entryPrice) * 100 * 100) / 100;

          /* Record strategy result for learning */
          const strategyKey = getStrategyKey(pos.strategy);
          const existing = state.strategyStats[strategyKey] || { wins: 0, losses: 0, totalPnl: 0, winRate: 0 };
          const wins = pnl > 0 ? existing.wins + 1 : existing.wins;
          const losses = pnl < 0 ? existing.losses + 1 : existing.losses;
          const total = wins + losses;

          return {
            positions: state.positions.map((p) =>
              p.id === id
                ? { ...p, status: 'closed' as const, currentPrice: price, pnl, pnlPercent, closePrice: price, closeReason: reason }
                : p
            ),
            strategyStats: {
              ...state.strategyStats,
              [strategyKey]: {
                wins,
                losses,
                totalPnl: Math.round((existing.totalPnl + pnl) * 100) / 100,
                winRate: total > 0 ? Math.round((wins / total) * 100) / 100 : 0,
              },
            },
          };
        }),

      updatePositionPrices: (priceMap) =>
        set((state) => ({
          positions: state.positions.map((p) => {
            if (p.status !== 'open') return p;
            const cur = priceMap[p.symbol] || p.currentPrice;
            const pnl =
              p.side === 'LONG'
                ? Math.round((cur - p.entryPrice) * p.size * 100) / 100
                : Math.round((p.entryPrice - cur) * p.size * 100) / 100;
            const pnlPercent =
              p.side === 'LONG'
                ? Math.round(((cur - p.entryPrice) / p.entryPrice) * 100 * 100) / 100
                : Math.round(((p.entryPrice - cur) / p.entryPrice) * 100 * 100) / 100;
            return { ...p, currentPrice: cur, pnl, pnlPercent };
          }),
        })),

      incrementCycle: () =>
        set((state) => ({ cycleCount: state.cycleCount + 1 })),

      setMood: (mood) => set({ mood }),

      setStress: (stressLevel) => set({ stressLevel: Math.max(0, Math.min(1, stressLevel)) }),

      setMarketStudyComplete: (marketStudyComplete) => set({ marketStudyComplete }),

      setMarketStudyData: (data) => set({ marketStudyData: data }),

      recordStrategyResult: (strategy, pnl) =>
        set((state) => {
          const key = getStrategyKey(strategy);
          const existing = state.strategyStats[key] || { wins: 0, losses: 0, totalPnl: 0, winRate: 0 };
          const wins = pnl > 0 ? existing.wins + 1 : existing.wins;
          const losses = pnl < 0 ? existing.losses + 1 : existing.losses;
          const total = wins + losses;
          return {
            strategyStats: {
              ...state.strategyStats,
              [key]: {
                wins,
                losses,
                totalPnl: Math.round((existing.totalPnl + pnl) * 100) / 100,
                winRate: total > 0 ? Math.round((wins / total) * 100) / 100 : 0,
              },
            },
          };
        }),

      setPositions: (positions) => set({ positions }),
    }),
    {
      name: 'alex-store-v5',
      partialize: (state) => ({
        settings: state.settings,
        strategyStats: state.strategyStats,
        cycleCount: state.cycleCount,
      }),
    }
  )
);
