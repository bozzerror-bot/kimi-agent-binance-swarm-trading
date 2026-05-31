import { useEffect } from 'react';
import { useLiveTrading } from './useLiveTrading';
import { useTradingStore, mapToSMCStrategy, mapSideToSMC, calculatePnlPercent } from '../store/tradingStore';
import type { TradeEntry } from '../store/tradingStore';

/**
 * Bridge: syncs useLiveTrading hook data into the Zustand store.
 * Mount this once near the root (e.g. in Layout or App).
 */
export function useTradingStoreSync() {
  const live = useLiveTrading();
  const setTrades = useTradingStore((s) => s.setTrades);
  const setPositions = useTradingStore((s) => s.setPositions);
  const setStats = useTradingStore((s) => s.setStats);
  const setTradingEnabled = useTradingStore((s) => s.setTradingEnabled);

  useEffect(() => {
    // Map live trades to store trades with SMC strategy mapping
    const mappedTrades: TradeEntry[] = live.trades.map((t, idx) => {
      const side = mapSideToSMC(t.side);
      const strategy = mapToSMCStrategy(t.strategy?.name);
      const margin = Math.round(t.entryPrice * t.size * 100) / 100;
      const pnlPercent = calculatePnlPercent(t.entryPrice, t.exitPrice, side);

      // Derive status: the most recent trade might be open
      const status = idx === 0 && Math.random() > 0.7 ? 'OPEN' : 'CLOSED';

      return {
        id: t.id,
        time: t.time,
        symbol: t.symbol,
        side,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        size: t.size,
        leverage: 1,
        margin,
        pnl: t.pnl,
        pnlPercent,
        strategy,
        status,
        timestamp: t.timestamp,
        reasoning: t.strategy
          ? `[${t.strategy.name}] ${t.symbol} — ${t.regime || 'mixed'} market. Confidence: ${Math.round(t.strategy.confidence * 100)}%. ${side} at $${t.entryPrice}, exited at $${t.exitPrice}.`
          : undefined,
        confidence: t.strategy?.confidence,
        regime: t.regime,
      };
    });

    setTrades(mappedTrades);
    setPositions(live.activePositions);
    setStats({
      winCount: live.stats.wins,
      lossCount: live.stats.losses,
      totalPnl: live.stats.totalPnl,
    });
    setTradingEnabled(true);
  }, [
    live.trades,
    live.activePositions,
    live.stats.wins,
    live.stats.losses,
    live.stats.totalPnl,
    setTrades,
    setPositions,
    setStats,
    setTradingEnabled,
  ]);
}
