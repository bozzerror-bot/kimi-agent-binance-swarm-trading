import { create } from 'zustand';
import type { Position } from '../data/mockData';

/* ═══════════════════════════════════════════════════════════
   SMC Strategy Types
   ═══════════════════════════════════════════════════════════ */
export type SMCSide = 'LONG' | 'SHORT';
export type SMCStatus = 'OPEN' | 'CLOSED';
export type SMCStrategy = 'BOS' | 'CHoCH' | 'TREND' | 'SCALP';

export interface TradeEntry {
  id: string;
  time: string;
  symbol: string;
  side: SMCSide;
  entryPrice: number;
  exitPrice: number;
  size: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnlPercent: number;
  strategy: SMCStrategy;
  status: SMCStatus;
  timestamp: string;
  reasoning?: string;
  confidence?: number;
  regime?: string;
  timeframe?: string;
}

export interface TradingStoreState {
  trades: TradeEntry[];
  positions: Position[];
  winCount: number;
  lossCount: number;
  totalPnl: number;
  isTradingEnabled: boolean;
  marketStudyComplete: boolean;

  // Filters
  filterSide: 'ALL' | SMCSide;
  filterSymbol: string;
  filterStrategy: 'ALL' | SMCStrategy;
  filterTimeframe: string;

  // Pagination
  pageSize: number;
  currentPage: number;

  // Strategy performance tracking
  strategyStats: Record<string, { wins: number; losses: number; totalPnl: number; winRate: number }>;

  // Actions
  setTrades: (trades: TradeEntry[]) => void;
  addTrade: (trade: TradeEntry) => void;
  setPositions: (positions: Position[]) => void;
  setStats: (stats: { winCount: number; lossCount: number; totalPnl: number }) => void;
  setTradingEnabled: (enabled: boolean) => void;
  setMarketStudyComplete: (complete: boolean) => void;
  recordStrategyResult: (strategy: string, pnl: number) => void;

  setFilterSide: (side: 'ALL' | SMCSide) => void;
  setFilterSymbol: (symbol: string) => void;
  setFilterStrategy: (strategy: 'ALL' | SMCStrategy) => void;
  setFilterTimeframe: (timeframe: string) => void;
  clearFilters: () => void;

  setPageSize: (size: number) => void;
  setCurrentPage: (page: number) => void;
}

/* ═══════════════════════════════════════════════════════════
   Helper: Map internal strategy name → SMC strategy badge
   ═══════════════════════════════════════════════════════════ */
export function mapToSMCStrategy(strategyName?: string): SMCStrategy {
  const name = (strategyName || '').toLowerCase();
  if (name.includes('break') || name === 'breakout') return 'BOS';
  if (name.includes('reversion') || name.includes('mean')) return 'CHoCH';
  if (name.includes('trend') || name.includes('following')) return 'TREND';
  if (name.includes('scalp') || name.includes('vwap')) return 'SCALP';
  // Default based on regime or random deterministic fallback
  if (name.includes('ranging')) return 'CHoCH';
  if (name.includes('volatile')) return 'BOS';
  if (name.includes('trending')) return 'TREND';
  return 'TREND';
}

export function mapSideToSMC(side: string): SMCSide {
  return side === 'SELL' ? 'SHORT' : 'LONG';
}

export function calculatePnlPercent(entry: number, exit: number, side: SMCSide): number {
  if (entry === 0) return 0;
  const raw = ((exit - entry) / entry) * 100;
  return side === 'LONG' ? raw : -raw;
}

function getStrategyKey(strategy: string): string {
  const s = strategy?.toUpperCase() || 'UNKNOWN';
  if (s.includes('BOS')) return 'BOS';
  if (s.includes('CHOC')) return 'CHoCH';
  if (s.includes('SCALP')) return 'SCALP';
  if (s.includes('TREND')) return 'TREND';
  return s;
}

export const useTradingStore = create<TradingStoreState>((set) => ({
  trades: [],
  positions: [],
  winCount: 0,
  lossCount: 0,
  totalPnl: 0,
  isTradingEnabled: false,
  marketStudyComplete: false,

  filterSide: 'ALL',
  filterSymbol: 'ALL',
  filterStrategy: 'ALL',
  filterTimeframe: 'ALL',

  pageSize: 10,
  currentPage: 0,

  strategyStats: {
    BOS: { wins: 0, losses: 0, totalPnl: 0, winRate: 0 },
    CHoCH: { wins: 0, losses: 0, totalPnl: 0, winRate: 0 },
    SCALP: { wins: 0, losses: 0, totalPnl: 0, winRate: 0 },
    TREND: { wins: 0, losses: 0, totalPnl: 0, winRate: 0 },
  },

  setTrades: (trades) => set({ trades }),
  addTrade: (trade) =>
    set((state) => {
      const newTrades = [trade, ...state.trades].slice(0, 200);
      const winCount = newTrades.filter((t) => t.pnl > 0).length;
      const lossCount = newTrades.filter((t) => t.pnl <= 0).length;
      const totalPnl = newTrades.reduce((sum, t) => sum + t.pnl, 0);
      return { trades: newTrades, winCount, lossCount, totalPnl };
    }),
  setPositions: (positions) => set({ positions }),
  setStats: (stats) =>
    set({
      winCount: stats.winCount,
      lossCount: stats.lossCount,
      totalPnl: stats.totalPnl,
    }),
  setTradingEnabled: (enabled) => set({ isTradingEnabled: enabled }),
  setMarketStudyComplete: (complete) => set({ marketStudyComplete: complete }),

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

  setFilterSide: (side) => set({ filterSide: side, currentPage: 0 }),
  setFilterSymbol: (symbol) => set({ filterSymbol: symbol, currentPage: 0 }),
  setFilterStrategy: (strategy) => set({ filterStrategy: strategy, currentPage: 0 }),
  setFilterTimeframe: (timeframe) => set({ filterTimeframe: timeframe, currentPage: 0 }),
  clearFilters: () =>
    set({
      filterSide: 'ALL',
      filterSymbol: 'ALL',
      filterStrategy: 'ALL',
      filterTimeframe: 'ALL',
      currentPage: 0,
    }),

  setPageSize: (size) => set({ pageSize: size, currentPage: 0 }),
  setCurrentPage: (page) => set({ currentPage: page }),
}));
