import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, type Time } from 'lightweight-charts';
import { motion } from 'framer-motion';
import { useAlexStore, COINS } from '@/store/useAlexStore';

const FAPI = 'https://fapi.binance.com/fapi/v1';

export default function ChartVisualizer() {
  const trades = useAlexStore(s => s.trades);
  const [selectedCoin, setSelectedCoin] = useState('BTCUSDT');
  const [interval, setInterval] = useState('15m');
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0a0a0f' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true },
      width: containerRef.current.clientWidth, height: 450,
    });
    chartRef.current = chart;
    const handleResize = () => { if (containerRef.current && chartRef.current) chartRef.current.applyOptions({ width: containerRef.current.clientWidth }); };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; } };
  }, [selectedCoin, interval]);

  useEffect(() => {
    if (!chartRef.current) return;
    setLoading(true);
    const load = async () => {
      try {
        const res = await fetch(`${FAPI}/klines?symbol=${selectedCoin}&interval=${interval}&limit=200`);
        const data = await res.json();
        const candles = (data as string[][]).map((c) => ({ time: (parseInt(c[0]) / 1000) as Time, open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]) }));
        const series = chartRef.current.addSeries(CandlestickSeries, { upColor: '#22c55e', downColor: '#ef4444', borderUpColor: '#22c55e', borderDownColor: '#ef4444', wickUpColor: '#22c55e', wickDownColor: '#ef4444' });
        series.setData(candles);
        const coinTrades = trades.filter(t => t.symbol === selectedCoin);
        if (coinTrades.length > 0 && candles.length > 20) {
          const refCandle = candles[Math.floor(candles.length / 2)];
          series.setMarkers(coinTrades.slice(0, 10).map((t) => ({ time: refCandle.time, position: t.side === 'LONG' ? 'belowBar' : 'aboveBar', color: t.side === 'LONG' ? '#22c55e' : '#ef4444', shape: t.side === 'LONG' ? 'arrowUp' : 'arrowDown', text: `${t.side === 'LONG' ? 'L' : 'S'} ${t.strategy}`, size: 2 })));
        }
        chartRef.current.timeScale().fitContent();
      } catch (e) { console.error('Chart error:', e); }
      setLoading(false);
    };
    load();
  }, [selectedCoin, interval, trades]);

  return (
    <div className="min-h-screen pb-8 px-3 sm:px-4 max-w-[1440px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div><h1 className="text-xl font-bold text-white">Chart Visualizer</h1><p className="text-xs text-gray-500">Live candlesticks with L/S entry markers</p></div>
        <div className="flex items-center gap-1">{['1m','5m','15m','1h','4h'].map(int => (
          <button key={int} onClick={() => setInterval(int)} className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono transition-all ${interval === int ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-[#13131e] text-gray-400 border border-white/[0.04]'}`}>{int}</button>
        ))}</div>
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {COINS.map(sym => (
          <button key={sym} onClick={() => setSelectedCoin(sym)} className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${selectedCoin === sym ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'bg-[#13131e] text-gray-500 border border-white/[0.04]'}`}>{sym.replace('USDT', '')}</button>
        ))}
      </div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-1 relative">
        {loading && <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0a0f]/50 rounded-2xl"><span className="text-xs text-gray-400 animate-pulse">Loading...</span></div>}
        <div ref={containerRef} style={{ width: '100%', height: 450 }} />
      </motion.div>
      <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="text-emerald-400">&#8593;</span> Long</span>
        <span className="flex items-center gap-1"><span className="text-red-400">&#8595;</span> Short</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Bullish</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Bearish</span>
      </div>
    </div>
  );
}
