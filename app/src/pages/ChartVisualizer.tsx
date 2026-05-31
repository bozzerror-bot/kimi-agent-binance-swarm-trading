import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  type IChartApi,
  type CandlestickData,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts';
import { motion } from 'framer-motion';
import { useTradingStore, type TradeEntry } from '../store/tradingStore';
import { COINS } from '../hooks/useBinancePrices';

const FAPI = 'https://fapi.binance.com/fapi/v1';

/** Fetch klines from Binance Futures */
async function fetchKlines(
  symbol: string,
  interval: string,
  limit: number
): Promise<CandlestickData[]> {
  const res = await fetch(
    `${FAPI}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as string[][];
  return data.map((c) => ({
    time: (parseInt(c[0]) / 1000) as Time,
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
  }));
}

export default function ChartVisualizer() {
  const trades = useTradingStore((s) => s.trades);
  const [selectedCoin, setSelectedCoin] = useState('BTCUSDT');
  const [interval, setInterval] = useState('15m');
  const [loading, setLoading] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  /* ── Initialize chart (once) ─────────────────────────────── */
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#0a0a0f' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: 1 },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
    });

    const series = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  /* ── Load candles + trade markers ────────────────────────── */
  const loadData = useCallback(async () => {
    if (!seriesRef.current) return;
    setLoading(true);

    try {
      const candles = await fetchKlines(selectedCoin, interval, 200);
      seriesRef.current.setData(candles);

      // Build a time-index map for marker placement
      const timeMap = new Map<number, number>();
      candles.forEach((c, i) => {
        const ts = typeof c.time === 'number' ? c.time : parseInt(c.time as string);
        timeMap.set(ts, i);
      });

      // Match trades to this coin
      const coinTrades = trades.filter(
        (t: TradeEntry) => t.symbol === selectedCoin
      );

      const markers = coinTrades
        .map((t: TradeEntry) => {
          // Try to find the candle closest to the trade's timestamp
          const tradeTs = Math.floor(
            new Date(t.timestamp).getTime() / 1000
          );

          // Find closest candle
          let closestTime: Time | null = null;
          let closestDiff = Infinity;
          candles.forEach((c) => {
            const cts = typeof c.time === 'number' ? c.time : parseInt(c.time as string);
            const diff = Math.abs(cts - tradeTs);
            if (diff < closestDiff) {
              closestDiff = diff;
              closestTime = c.time;
            }
          });

          if (!closestTime && candles.length > 0) {
            closestTime = candles[candles.length - 1].time;
          }

          const isLong = t.side === 'LONG';

          return {
            time: closestTime!,
            position: (isLong ? 'belowBar' : 'aboveBar') as 'belowBar' | 'aboveBar',
            color: isLong ? '#22c55e' : '#ef4444',
            shape: (isLong ? 'arrowUp' : 'arrowDown') as 'arrowUp' | 'arrowDown',
            text: `${isLong ? 'L' : 'S'} ${t.strategy}`,
            size: 2 as const,
          };
        })
        .filter((m) => m.time !== null);

      seriesRef.current.setMarkers(markers);
      chartRef.current?.timeScale().fitContent();
    } catch {
      /* silent fail — network hiccups happen */
    }

    setLoading(false);
  }, [selectedCoin, interval, trades]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen pb-8 px-4 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Chart Visualizer</h1>
          <p className="text-sm text-gray-500">
            Alex&apos;s trade entries on live candlesticks
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['1m', '5m', '15m', '1h', '4h'].map((int) => (
            <button
              key={int}
              onClick={() => setInterval(int)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                interval === int
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-[#13131e] text-gray-400 border border-white/5'
              }`}
            >
              {int}
            </button>
          ))}
        </div>
      </div>

      {/* Coin selector */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {COINS.map((sym) => (
          <button
            key={sym}
            onClick={() => setSelectedCoin(sym)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all ${
              selectedCoin === sym
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                : 'bg-[#13131e] text-gray-500 border border-white/5'
            }`}
          >
            {sym.replace('USDT', '')}
          </button>
        ))}
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#13131e] border border-white/5 rounded-2xl p-1 relative"
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0a0f]/50 rounded-2xl">
            <div className="text-sm text-gray-400 animate-pulse">
              Loading candles...
            </div>
          </div>
        )}
        <div ref={chartContainerRef} style={{ width: '100%', height: 500 }} />
      </motion.div>

      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="text-emerald-400 text-lg">&#8593;</span> Long Entry
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-red-400 text-lg">&#8595;</span> Short Entry
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />{' '}
          Bullish candle
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />{' '}
          Bearish candle
        </div>
      </div>
    </div>
  );
}
