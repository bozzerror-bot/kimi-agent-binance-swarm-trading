import { useEffect, useRef } from 'react';

const FUTURES_API = 'https://fapi.binance.com/fapi/v1';

/** COINS is string[] — just the Binance futures symbols */
export const COINS: string[] = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'MATICUSDT', 'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'ETCUSDT',
  'FILUSDT', 'ARBUSDT', 'OPUSDT', 'NEARUSDT', 'APTUSDT',
];

export interface PriceUpdate {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  isReal: boolean;
}

/** Module-level price cache — components can import and read */
let priceCache: Map<string, PriceUpdate> = new Map();

export function getPriceCache(): Map<string, PriceUpdate> {
  return priceCache;
}

export function useBinancePrices() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        /* ── Stage 1: exact mark prices ── */
        const priceRes = await fetch(`${FUTURES_API}/ticker/price`);
        if (!priceRes.ok) throw new Error(`HTTP ${priceRes.status}`);
        const priceData = await priceRes.json() as Array<{ symbol: string; price: string }>;
        const priceMap = new Map(priceData.map((d) => [d.symbol, parseFloat(d.price)]));

        /* ── Stage 2: 24h statistics ── */
        const statsRes = await fetch(`${FUTURES_API}/ticker/24hr`);
        if (!statsRes.ok) throw new Error(`HTTP ${statsRes.status}`);
        const statsData = await statsRes.json() as Array<Record<string, unknown>>;
        const statsMap = new Map(statsData.map((d) => [d.symbol as string, d]));

        /* ── Merge: mark price + 24h stats ── */
        const updates: PriceUpdate[] = COINS.map((sym) => {
          const markPrice = priceMap.get(sym);
          const stats = statsMap.get(sym);
          if (!markPrice || !stats) return null;
          return {
            symbol: sym,
            name: sym.replace('USDT', ''),
            price: markPrice,
            change24h: parseFloat(stats.priceChangePercent as string),
            high24h: parseFloat(stats.highPrice as string),
            low24h: parseFloat(stats.lowPrice as string),
            volume24h: parseFloat(stats.volume as string),
            isReal: true,
          };
        }).filter((u): u is PriceUpdate => u !== null);

        if (updates.length > 0) {
          for (const u of updates) {
            priceCache.set(u.symbol, u);
          }
        }
      } catch {
        // Retry next cycle
      }
    };

    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
