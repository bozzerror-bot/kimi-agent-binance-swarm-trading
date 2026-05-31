import { useEffect, useRef } from 'react';
import { COINS, useAlexStore } from '@/store/useAlexStore';
const FAPI = 'https://fapi.binance.com/fapi/v1';
export function useBinancePrices() {
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const r1 = await fetch(`${FAPI}/ticker/price`);
        const pd = r1.ok ? await r1.json() : [];
        const r2 = await fetch(`${FAPI}/ticker/24hr`);
        const sd = r2.ok ? await r2.json() : [];
        const updates = COINS.map(sym => {
          const pi = pd.find((d: Record<string, unknown>) => d.symbol === sym);
          const si = sd.find((d: Record<string, unknown>) => d.symbol === sym);
          if (!pi) return null;
          return { symbol: sym, name: sym.replace('USDT', ''), price: parseFloat(pi.price as string), change24h: si ? parseFloat(si.priceChangePercent as string) : 0, high24h: si ? parseFloat(si.highPrice as string) : 0, low24h: si ? parseFloat(si.lowPrice as string) : 0, volume24h: si ? parseFloat(si.volume as string) : 0, isReal: true };
        }).filter(Boolean);
        if (updates.length > 0) {
          const s = useAlexStore.getState();
          s.setCoins(updates as Parameters<typeof s.setCoins>[0]);
          for (const u of updates) if (u) s.addPriceHistory(u.symbol, u.price);
        }
      } catch {}
    };
    fetchPrices();
    iv.current = setInterval(fetchPrices, 3000);
    return () => { if (iv.current) clearInterval(iv.current); };
  }, []);
}
