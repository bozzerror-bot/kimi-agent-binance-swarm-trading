import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Download,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FilterX,
  BarChart3,
  Target,
  TrendingUp,
  Layers,
  ClipboardList,
} from 'lucide-react';
import { useTradingStore } from '../store/tradingStore';
import type { TradeEntry, SMCSide, SMCStrategy } from '../store/tradingStore';

/* ═══════════════════════════════════════════════════════════
   Type for strategy stats (mirrors store shape)
   ═══════════════════════════════════════════════════════════ */
interface StrategyStat {
  wins: number;
  losses: number;
  totalPnl: number;
  winRate: number;
}

/* ═══════════════════════════════════════════════════════════
   Card wrapper
   ═══════════════════════════════════════════════════════════ */
function Card({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-[14px] border border-[rgba(255,255,255,0.06)] p-5 transition-all duration-200 hover:border-[rgba(255,255,255,0.10)] ${className}`}
      style={{ backgroundColor: '#13131F' }}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Formatting helpers
   ═══════════════════════════════════════════════════════════ */
function formatMoney(value: number): string {
  const absVal = Math.abs(value);
  if (absVal >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (absVal >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return iso;
  }
}

/* ═══════════════════════════════════════════════════════════
   SMC Strategy badge component
   ═══════════════════════════════════════════════════════════ */
const STRATEGY_BADGE: Record<SMCStrategy, { bg: string; text: string; label: string }> = {
  BOS: { bg: 'rgba(47,163,255,0.12)', text: '#2FA3FF', label: 'BOS' },
  CHoCH: { bg: 'rgba(168,85,247,0.12)', text: '#A855F7', label: 'CHoCH' },
  TREND: { bg: 'rgba(47,255,107,0.10)', text: '#2FFF6B', label: 'TREND' },
  SCALP: { bg: 'rgba(255,170,0,0.12)', text: '#FFAA00', label: 'SCALP' },
};

function StrategyBadge({ strategy }: { strategy: SMCStrategy }) {
  const cfg = STRATEGY_BADGE[strategy];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold font-jetbrains"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
      title={strategy === 'BOS' ? 'Break of Structure' : strategy === 'CHoCH' ? 'Change of Character' : strategy === 'TREND' ? 'Trend Following' : 'Scalp/Momentum Play'}
    >
      {cfg.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Side badge
   ═══════════════════════════════════════════════════════════ */
function SideBadge({ side }: { side: SMCSide }) {
  const isLong = side === 'LONG';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold font-jetbrains tracking-wide"
      style={{
        backgroundColor: isLong ? 'rgba(47,255,107,0.10)' : 'rgba(255,68,68,0.10)',
        color: isLong ? '#2FFF6B' : '#FF4444',
      }}
    >
      {side}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Long/Short marker — Binance-style circle badge
   ═══════════════════════════════════════════════════════════ */
function LSMarker({ side }: { side: SMCSide }) {
  const isLong = side === 'LONG';
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold font-jetbrains"
      style={{
        backgroundColor: isLong ? 'rgba(47,255,107,0.15)' : 'rgba(255,68,68,0.15)',
        color: isLong ? '#2FFF6B' : '#FF4444',
        border: `1px solid ${isLong ? 'rgba(47,255,107,0.25)' : 'rgba(255,68,68,0.25)'}`,
      }}
      title={isLong ? 'Long Position' : 'Short Position'}
    >
      {isLong ? 'L' : 'S'}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Strategy win-rate badge
   ═══════════════════════════════════════════════════════════ */
function StrategyWinRateBadge({ strategy, stats }: { strategy: SMCStrategy; stats: Record<string, StrategyStat> }) {
  const stat = stats[strategy];
  if (!stat || stat.wins + stat.losses === 0) return null;
  const pct = Math.round(stat.winRate * 100);
  const color = pct >= 60 ? '#2FFF6B' : pct >= 40 ? '#FFAA00' : '#FF4444';
  return (
    <span
      className="ml-1.5 inline-flex items-center px-1.5 py-0 rounded text-[10px] font-semibold font-jetbrains"
      style={{ backgroundColor: `${color}18`, color }}
      title={`${stat.wins}W / ${stat.losses}L · $${stat.totalPnl >= 0 ? '+' : ''}${stat.totalPnl.toFixed(1)}`}
    >
      {pct}%
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Status badge
   ═══════════════════════════════════════════════════════════ */
function StatusBadge({ status }: { status: 'OPEN' | 'CLOSED' }) {
  const isOpen = status === 'OPEN';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold font-jetbrains"
      style={{
        backgroundColor: isOpen ? 'rgba(47,163,255,0.10)' : 'rgba(255,255,255,0.06)',
        color: isOpen ? '#2FA3FF' : 'rgba(255,255,255,0.40)',
      }}
    >
      {status}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   P&L display
   ═══════════════════════════════════════════════════════════ */
function PnlDisplay({ value, isPercent = false }: { value: number; isPercent?: boolean }) {
  const isProfit = value >= 0;
  const prefix = isPercent ? '' : '$';
  const suffix = isPercent ? '%' : '';
  const sign = isProfit ? '+' : '';
  return (
    <span
      className="font-jetbrains font-semibold"
      style={{ color: isProfit ? '#2FFF6B' : '#FF4444' }}
    >
      {sign}{prefix}{formatMoney(value)}{suffix}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════
   Stat card
   ═══════════════════════════════════════════════════════════ */
function StatCard({
  label,
  value,
  sub,
  icon,
  delay,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  delay: number;
}) {
  return (
    <Card delay={delay} className="flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
      >
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase text-text-muted font-inter">{label}</p>
        <p className="font-jetbrains text-xl font-bold text-white">{value}</p>
        {sub && <p className="text-[11px] text-text-muted font-inter mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   Pill button for filters
   ═══════════════════════════════════════════════════════════ */
function FilterPill({
  label,
  active,
  onClick,
  color = 'white',
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold font-jetbrains transition-all duration-200 border"
      style={{
        backgroundColor: active ? `${color}14` : 'transparent',
        borderColor: active ? `${color}40` : 'rgba(255,255,255,0.06)',
        color: active ? color : 'rgba(255,255,255,0.40)',
      }}
    >
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════
   Expanded row detail
   ═══════════════════════════════════════════════════════════ */
function ExpandedRow({ trade }: { trade: TradeEntry }) {
  return (
    <tr>
      <td colSpan={14} className="px-0 py-0">
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div
            className="mx-4 mb-3 rounded-xl border border-[rgba(255,255,255,0.06)] px-5 py-4"
            style={{ backgroundColor: '#0C0C12' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={14} className="text-accent-blue" />
              <span className="text-sm font-semibold text-white font-inter">Trade Details</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div>
                <p className="text-[11px] text-text-muted font-inter mb-0.5">Entry Price</p>
                <p className="font-jetbrains text-sm font-medium text-white">${formatMoney(trade.entryPrice)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-inter mb-0.5">Exit Price</p>
                <p className="font-jetbrains text-sm font-medium text-white">${formatMoney(trade.exitPrice)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-inter mb-0.5">Position Size</p>
                <p className="font-jetbrains text-sm font-medium text-white">{trade.size}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-inter mb-0.5">Margin Used</p>
                <p className="font-jetbrains text-sm font-medium text-white">${formatMoney(trade.margin)}</p>
              </div>
              <div>
                <p className="text-[11px] text-text-muted font-inter mb-0.5">Timeframe</p>
                <p className="font-jetbrains text-sm font-medium text-white">{trade.timeframe || '-'}</p>
              </div>
            </div>

            {trade.reasoning && (
              <div className="mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
                <p className="text-[11px] text-text-muted font-inter mb-1">Alex&apos;s Reasoning</p>
                <p className="text-sm text-text-secondary font-inter leading-relaxed">{trade.reasoning}</p>
              </div>
            )}

            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[rgba(255,255,255,0.04)]">
              {trade.confidence !== undefined && (
                <div>
                  <p className="text-[11px] text-text-muted font-inter mb-0.5">Confidence</p>
                  <p className="font-jetbrains text-sm font-medium text-accent-blue">{Math.round(trade.confidence * 100)}%</p>
                </div>
              )}
              {trade.regime && (
                <div>
                  <p className="text-[11px] text-text-muted font-inter mb-0.5">Market Regime</p>
                  <p className="font-jetbrains text-sm font-medium text-warning">{trade.regime}</p>
                </div>
              )}
              <div>
                <p className="text-[11px] text-text-muted font-inter mb-0.5">P&L %</p>
                <p className="font-jetbrains text-sm font-medium">
                  <PnlDisplay value={trade.pnlPercent} isPercent />
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════
   CSV Export
   ═══════════════════════════════════════════════════════════ */
function exportTradesCSV(trades: TradeEntry[]) {
  if (trades.length === 0) return;

  const headers = [
    'ID', 'Time', 'Symbol', 'Side', 'Entry Price', 'Exit Price',
    'Size', 'Leverage', 'Margin', 'P&L ($)', 'P&L (%)',
    'Strategy', 'Status', 'Reasoning',
  ];

  const rows = trades.map((t) => [
    t.id,
    t.time,
    t.symbol,
    t.side,
    t.entryPrice,
    t.exitPrice,
    t.size,
    t.leverage,
    t.margin,
    t.pnl,
    t.pnlPercent.toFixed(2),
    t.strategy,
    t.status,
    t.reasoning || '',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `alex-trades-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/* ═══════════════════════════════════════════════════════════
   Strategy Performance card
   ═══════════════════════════════════════════════════════════ */
function StrategyPerformanceCard({
  strategy,
  stat,
  delay,
}: {
  strategy: SMCStrategy;
  stat: StrategyStat;
  delay: number;
}) {
  const cfg = STRATEGY_BADGE[strategy];
  const total = stat.wins + stat.losses;
  const pct = total > 0 ? Math.round(stat.winRate * 100) : 0;
  const pnlColor = stat.totalPnl >= 0 ? '#2FFF6B' : '#FF4444';
  return (
    <Card delay={delay} className="flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: cfg.bg }}
      >
        <span className="text-xs font-bold font-jetbrains" style={{ color: cfg.text }}>
          {cfg.label}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white font-inter">{strategy}</span>
          <span className="text-[11px] font-jetbrains" style={{ color: pnlColor }}>
            {stat.totalPnl >= 0 ? '+' : ''}${stat.totalPnl.toFixed(1)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                backgroundColor: pct >= 60 ? '#2FFF6B' : pct >= 40 ? '#FFAA00' : '#FF4444',
              }}
            />
          </div>
          <span className="text-[11px] font-jetbrains text-text-muted shrink-0">
            {pct}% · {total}t
          </span>
        </div>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN: Logs Page
   ═══════════════════════════════════════════════════════════ */
export default function Logs() {
  const trades = useTradingStore((s) => s.trades);
  const positions = useTradingStore((s) => s.positions);
  const winCount = useTradingStore((s) => s.winCount);
  const lossCount = useTradingStore((s) => s.lossCount);
  const totalPnl = useTradingStore((s) => s.totalPnl);

  const filterSide = useTradingStore((s) => s.filterSide);
  const filterSymbol = useTradingStore((s) => s.filterSymbol);
  const filterStrategy = useTradingStore((s) => s.filterStrategy);
  const filterTimeframe = useTradingStore((s) => s.filterTimeframe);
  const pageSize = useTradingStore((s) => s.pageSize);
  const currentPage = useTradingStore((s) => s.currentPage);
  const strategyStats = useTradingStore((s) => s.strategyStats);

  const setFilterSide = useTradingStore((s) => s.setFilterSide);
  const setFilterSymbol = useTradingStore((s) => s.setFilterSymbol);
  const setFilterStrategy = useTradingStore((s) => s.setFilterStrategy);
  const setFilterTimeframe = useTradingStore((s) => s.setFilterTimeframe);
  const clearFilters = useTradingStore((s) => s.clearFilters);
  const setPageSize = useTradingStore((s) => s.setPageSize);
  const setCurrentPage = useTradingStore((s) => s.setCurrentPage);

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Derived: unique symbols for dropdown
  const allSymbols = useMemo(() => {
    const symbols = Array.from(new Set(trades.map((t) => t.symbol)));
    return symbols.sort();
  }, [trades]);

  // Derived: filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (filterSide !== 'ALL' && t.side !== filterSide) return false;
      if (filterSymbol !== 'ALL' && t.symbol !== filterSymbol) return false;
      if (filterStrategy !== 'ALL' && t.strategy !== filterStrategy) return false;
      if (filterTimeframe !== 'ALL' && t.timeframe !== filterTimeframe) return false;
      return true;
    });
  }, [trades, filterSide, filterSymbol, filterStrategy, filterTimeframe]);

  // Derived: paginated trades
  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize));
  const safePage = Math.min(currentPage, totalPages - 1);
  const paginatedTrades = useMemo(() => {
    const start = safePage * pageSize;
    return filteredTrades.slice(start, start + pageSize);
  }, [filteredTrades, safePage, pageSize]);

  // Stats
  const openPositionsCount = positions.filter((p) => 'status' in p ? (p as Record<string, unknown>).status === 'open' : true).length;
  const winRate = winCount + lossCount > 0 ? Math.round((winCount / (winCount + lossCount)) * 100) : 0;

  const handleExport = useCallback(() => {
    exportTradesCSV(filteredTrades);
  }, [filteredTrades]);

  const toggleRow = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  // Sync page if out of bounds
  if (currentPage !== safePage) {
    setCurrentPage(safePage);
  }

  return (
    <div className="min-h-[calc(100dvh-56px-40px)] px-4 py-6 max-w-[1440px] mx-auto">
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <ClipboardList size={22} className="text-accent-blue" />
          <h1 className="font-inter text-2xl font-bold text-white">Trading Logs</h1>
        </div>
        <p className="font-inter text-sm text-text-secondary ml-[34px]">
          Real trade history from Alex&apos;s decisions
        </p>
      </motion.div>

      {/* ─── Stats Row ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Trades"
          value={String(trades.length)}
          sub={`${winCount} wins / ${lossCount} losses`}
          icon={<Target size={18} className="text-accent-blue" />}
          delay={0}
        />
        <StatCard
          label="Win Rate"
          value={`${winRate}%`}
          sub={winCount + lossCount > 0 ? `${winCount + lossCount} total` : 'No trades yet'}
          icon={<TrendingUp size={18} className="text-profit" />}
          delay={1}
        />
        <StatCard
          label="Total P&L"
          value={`${totalPnl >= 0 ? '+' : ''}$${formatMoney(totalPnl)}`}
          sub="All-time realized"
          icon={<BarChart3 size={18} className={totalPnl >= 0 ? 'text-profit' : 'text-loss'} />}
          delay={2}
        />
        <StatCard
          label="Open Positions"
          value={String(openPositionsCount)}
          sub="Currently active"
          icon={<Layers size={18} className="text-warning" />}
          delay={3}
        />
      </div>

      {/* ─── Strategy Performance ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12, duration: 0.4 }}
        className="mb-4"
      >
        <p className="text-[11px] font-semibold tracking-[0.04em] uppercase text-text-muted font-inter mb-2 ml-1">
          Strategy Performance
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(['BOS', 'CHoCH', 'TREND', 'SCALP'] as SMCStrategy[]).map((s, i) => (
            <StrategyPerformanceCard key={s} strategy={s} stat={strategyStats[s] || { wins: 0, losses: 0, totalPnl: 0, winRate: 0 }} delay={i} />
          ))}
        </div>
      </motion.div>

      {/* ─── Filter Bar ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="rounded-[14px] border border-[rgba(255,255,255,0.06)] px-4 py-3 mb-4"
        style={{ backgroundColor: '#13131F' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Side filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-text-muted font-inter mr-1">SIDE</span>
            <FilterPill label="ALL" active={filterSide === 'ALL'} onClick={() => setFilterSide('ALL')} color="#FFFFFF" />
            <FilterPill label="LONG" active={filterSide === 'LONG'} onClick={() => setFilterSide('LONG')} color="#2FFF6B" />
            <FilterPill label="SHORT" active={filterSide === 'SHORT'} onClick={() => setFilterSide('SHORT')} color="#FF4444" />
          </div>

          <div className="w-px h-5 bg-[rgba(255,255,255,0.08)]" />

          {/* Symbol dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-text-muted font-inter mr-1">SYMBOL</span>
            <select
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
              className="bg-[#0C0C12] border border-[rgba(255,255,255,0.08)] rounded-lg px-2.5 py-1.5 text-xs font-jetbrains text-white outline-none focus:border-[rgba(255,255,255,0.15)] transition-colors cursor-pointer"
            >
              <option value="ALL">All Symbols</option>
              {allSymbols.map((sym) => (
                <option key={sym} value={sym}>{sym}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-[rgba(255,255,255,0.08)]" />

          {/* Strategy filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-text-muted font-inter mr-1">STRATEGY</span>
            <FilterPill label="ALL" active={filterStrategy === 'ALL'} onClick={() => setFilterStrategy('ALL')} color="#FFFFFF" />
            <FilterPill label="BOS" active={filterStrategy === 'BOS'} onClick={() => setFilterStrategy('BOS')} color="#2FA3FF" />
            <FilterPill label="CHoCH" active={filterStrategy === 'CHoCH'} onClick={() => setFilterStrategy('CHoCH')} color="#A855F7" />
            <FilterPill label="TREND" active={filterStrategy === 'TREND'} onClick={() => setFilterStrategy('TREND')} color="#2FFF6B" />
            <FilterPill label="SCALP" active={filterStrategy === 'SCALP'} onClick={() => setFilterStrategy('SCALP')} color="#FFAA00" />
          </div>

          <div className="w-px h-5 bg-[rgba(255,255,255,0.08)]" />

          {/* Timeframe filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-text-muted font-inter mr-1">TF</span>
            {['ALL', '1m', '5m', '15m', '1h'].map((tf) => (
              <FilterPill
                key={tf}
                label={tf}
                active={filterTimeframe === tf}
                onClick={() => setFilterTimeframe(tf)}
                color={tf === 'ALL' ? '#FFFFFF' : '#2FA3FF'}
              />
            ))}
          </div>

          <div className="flex-1" />

          {/* Clear + Export */}
          <div className="flex items-center gap-2">
            {(filterSide !== 'ALL' || filterSymbol !== 'ALL' || filterStrategy !== 'ALL' || filterTimeframe !== 'ALL') && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-inter border border-[rgba(255,255,255,0.08)] text-text-muted hover:text-white hover:border-[rgba(255,255,255,0.15)] transition-all"
              >
                <FilterX size={13} />
                Clear
              </button>
            )}
            <button
              onClick={handleExport}
              disabled={filteredTrades.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-inter border border-[rgba(255,255,255,0.08)] text-text-muted hover:text-white hover:border-[rgba(255,255,255,0.15)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download size={13} />
              Export CSV
            </button>
          </div>
        </div>
      </motion.div>

      {/* ─── Trades Table ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="rounded-[14px] border border-[rgba(255,255,255,0.06)] overflow-hidden"
        style={{ backgroundColor: '#13131F' }}
      >
        {filteredTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <ClipboardList size={36} className="text-text-muted mb-3 opacity-40" />
            <p className="text-sm text-text-secondary font-inter text-center">
              {trades.length === 0
                ? "No trades yet. Enable trading to see Alex in action."
                : "No trades match the current filters."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)]">
                    {['ID', 'Time', 'Symbol', 'L/S', 'Side', 'TF', 'Price', 'Size', 'Leverage', 'Margin', 'P&L $', 'P&L %', 'Strategy', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-[10px] font-semibold tracking-[0.06em] uppercase text-text-muted font-inter whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrades.map((trade) => (
                    <>
                      <tr
                        key={trade.id}
                        onClick={() => toggleRow(trade.id)}
                        className="border-b border-[rgba(255,255,255,0.03)] transition-colors duration-150 hover:bg-[rgba(255,255,255,0.02)] cursor-pointer"
                      >
                        <td className="px-4 py-3 font-jetbrains text-xs text-white">{trade.id}</td>
                        <td className="px-4 py-3 font-jetbrains text-xs text-text-secondary whitespace-nowrap">{formatTime(trade.timestamp)}</td>
                        <td className="px-4 py-3 font-jetbrains text-xs text-white font-medium">{trade.symbol}</td>
                        <td className="px-4 py-3"><LSMarker side={trade.side} /></td>
                        <td className="px-4 py-3"><SideBadge side={trade.side} /></td>
                        <td className="px-4 py-3 font-jetbrains text-xs text-text-secondary">{trade.timeframe || '-'}</td>
                        <td className="px-4 py-3 font-jetbrains text-xs text-white whitespace-nowrap">${formatMoney(trade.entryPrice)}</td>
                        <td className="px-4 py-3 font-jetbrains text-xs text-white">{trade.size}</td>
                        <td className="px-4 py-3 font-jetbrains text-xs text-text-secondary">{trade.leverage}x</td>
                        <td className="px-4 py-3 font-jetbrains text-xs text-white whitespace-nowrap">${formatMoney(trade.margin)}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><PnlDisplay value={trade.pnl} /></td>
                        <td className="px-4 py-3 whitespace-nowrap"><PnlDisplay value={trade.pnlPercent} isPercent /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <StrategyBadge strategy={trade.strategy} />
                            <StrategyWinRateBadge strategy={trade.strategy} stats={strategyStats} />
                          </div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={trade.status} /></td>
                        <td className="px-4 py-3">
                          <button className="text-text-muted hover:text-white transition-colors">
                            {expandedRow === trade.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === trade.id && (
                        <ExpandedRow trade={trade} />
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ─── Pagination ─── */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-text-muted font-inter">
                  {filteredTrades.length} trade{filteredTrades.length !== 1 ? 's' : ''}
                </span>
                <div className="flex items-center gap-1">
                  {[10, 25, 50].map((size) => (
                    <button
                      key={size}
                      onClick={() => setPageSize(size)}
                      className="px-2 py-0.5 rounded text-[11px] font-jetbrains transition-all border"
                      style={{
                        backgroundColor: pageSize === size ? 'rgba(255,255,255,0.08)' : 'transparent',
                        borderColor: pageSize === size ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: pageSize === size ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                      }}
                    >
                      {size}
                    </button>
                  ))}
                  <span className="text-[11px] text-text-muted font-inter ml-1">per page</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold font-inter border border-[rgba(255,255,255,0.08)] text-text-muted hover:text-white hover:border-[rgba(255,255,255,0.15)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>
                <span className="text-xs font-jetbrains text-text-secondary px-2">
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages - 1, safePage + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold font-inter border border-[rgba(255,255,255,0.08)] text-text-muted hover:text-white hover:border-[rgba(255,255,255,0.15)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
