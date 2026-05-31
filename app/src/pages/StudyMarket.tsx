import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, BookOpen, TrendingUp, Target, Activity, Check, RefreshCw, Brain, Clock } from 'lucide-react';
import { useAlexStore, COINS, type StudyCoinData } from '@/store/useAlexStore';

const FAPI = 'https://fapi.binance.com/fapi/v1';

function fmtPrice(n: number): string {
  if (!n || n <= 0) return '---';
  if (n >= 10000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 100) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (n >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 0.01) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

function ema(prices: number[], period: number): number { if (prices.length < period) return prices[prices.length - 1] || 0; const m = 2 / (period + 1); let e = prices.slice(0, period).reduce((a, b) => a + b, 0) / period; for (let i = period; i < prices.length; i++) e = (prices[i] - e) * m + e; return e; }
function calcTrend(closes: number[]): 'uptrend' | 'downtrend' | 'sideways' { if (closes.length < 50) return 'sideways'; const e9 = ema(closes, 9), e20 = ema(closes, 20), e50 = ema(closes, 50); const p = closes[closes.length - 1]; if (p > e9 && e9 > e20 && e20 > e50) return 'uptrend'; if (p < e9 && e9 < e20 && e20 < e50) return 'downtrend'; return 'sideways'; }
function calcSR(candles: { high: number; low: number }[]) { const highs = candles.map(c => c.high).sort((a, b) => b - a).slice(0, 15); const lows = candles.map(c => c.low).sort((a, b) => a - b).slice(0, 15); return { support: lows.reduce((a, b) => a + b, 0) / lows.length, resistance: highs.reduce((a, b) => a + b, 0) / highs.length }; }

async function fetchKlines(symbol: string, interval: string, limit: number) {
  const res = await fetch(`${FAPI}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  const data = await res.json();
  return (data as string[][]).map(c => ({ open: parseFloat(c[1]), high: parseFloat(c[2]), low: parseFloat(c[3]), close: parseFloat(c[4]), volume: parseFloat(c[5]) }));
}

export default function StudyMarket() {
  const store = useAlexStore();
  const coins = useAlexStore(s => s.coins);
  const [phase, setPhase] = useState<'idle' | 'studying' | 'done'>(store.marketStudyComplete ? 'done' : 'idle');
  const [progress, setProgress] = useState(store.marketStudyProgress);
  const [current, setCurrent] = useState('');
  const [logs, setLogs] = useState<string[]>([]);

  const startStudy = useCallback(async () => {
    setPhase('studying'); setProgress(0); setLogs(['Starting market study...']);
    const studyData: Record<string, StudyCoinData> = {};
    for (let i = 0; i < COINS.length; i++) {
      const sym = COINS[i]; setCurrent(sym); setProgress(Math.round((i / COINS.length) * 100));
      setLogs(prev => [`Analyzing ${sym}...`, ...prev].slice(0, 15));
      try {
        const [c15m, c1h] = await Promise.all([fetchKlines(sym, '15m', 500), fetchKlines(sym, '1h', 200)]);
        const c15 = c15m.map(c => c.close); const c1 = c1h.map(c => c.close);
        const sr = calcSR(c15m); const vol = c15m.slice(-14).reduce((s, c) => s + (c.high - c.low), 0) / 14;
        const avgVol = c15m.reduce((s, c) => s + c.volume, 0) / c15m.length;
        studyData[sym] = { supportLevels: [sr.support], resistanceLevels: [sr.resistance], trendDirection: calcTrend(c15), trend15m: calcTrend(c15), trend1h: calcTrend(c1), volatility: vol, avgVolume: avgVol, bestTimes: calcTrend(c15) === 'uptrend' ? 'Follow trend, buy dips' : calcTrend(c15) === 'downtrend' ? 'Short rallies' : 'Wait for breakout', lastUpdated: Date.now() };
      } catch { studyData[sym] = { supportLevels: [0], resistanceLevels: [0], trendDirection: 'sideways', trend15m: 'sideways', trend1h: 'sideways', volatility: 0, avgVolume: 0, bestTimes: 'No data', lastUpdated: Date.now() }; }
      await new Promise(r => setTimeout(r, 200));
    }
    store.setMarketStudyData(studyData); store.setMarketStudyProgress(100); store.setMarketStudyComplete(true);
    setProgress(100); setPhase('done');
    setLogs(prev => [`Done! ${COINS.length} coins analyzed.`, ...prev]);
  }, [store]);

  if (phase === 'done') return (
    <div className="min-h-screen pb-8 px-3 sm:px-4 max-w-[1440px] mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"><Check size={20} className="text-emerald-400" /></div>
          <div><h1 className="text-xl font-bold text-white">Market Study Complete</h1><p className="text-xs text-gray-400">Alex analyzed 15m + 1h trends across all 20 coins</p></div>
        </div>
      </motion.div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {COINS.map(sym => {
          const d = store.marketStudyData[sym]; if (!d) return null;
          const coin = coins.find(c => c.symbol === sym);
          return (
            <motion.div key={sym} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#13131e] border border-white/[0.04] rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">{sym.replace('USDT', '')}</span>
                <div className="flex gap-1">
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${d.trend15m === 'uptrend' ? 'bg-emerald-500/20 text-emerald-400' : d.trend15m === 'downtrend' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>15m</span>
                  <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${d.trend1h === 'uptrend' ? 'bg-emerald-500/20 text-emerald-400' : d.trend1h === 'downtrend' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>1h</span>
                </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-gray-500">Price</span><span className="text-white font-mono font-semibold">{coin && coin.price > 0 ? fmtPrice(coin.price) : '---'}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-500 flex items-center gap-1"><ArrowUp size={10} className="text-emerald-400" /> Support</span><span className="text-emerald-400 font-mono">{fmtPrice(d.supportLevels[0])}</span></div>
                <div className="flex justify-between items-center"><span className="text-gray-500 flex items-center gap-1"><ArrowDown size={10} className="text-red-400" /> Resistance</span><span className="text-red-400 font-mono">{fmtPrice(d.resistanceLevels[0])}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Vol (ATR)</span><span className="text-yellow-400 font-mono">{d.volatility > 0 ? '$' + d.volatility.toFixed(2) : '---'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Volume</span><span className="text-blue-400 font-mono">{(d.avgVolume / 1e6).toFixed(1)}M</span></div>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="flex gap-3 mt-6">
        <Link to="/" className="px-5 py-2.5 bg-emerald-500 text-black font-bold rounded-xl flex items-center gap-2 text-sm">Go to Dashboard</Link>
        <button onClick={() => { setPhase('idle'); store.setMarketStudyComplete(false); store.setMarketStudyProgress(0); }} className="px-4 py-2.5 bg-white/5 text-gray-400 rounded-xl text-xs flex items-center gap-2 hover:bg-white/10"><RefreshCw size={12} /> Re-study</button>
      </div>
    </div>
  );

  if (phase === 'studying') return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center animate-pulse"><Brain size={24} className="text-white" /></div>
        <h2 className="text-lg font-bold text-white mb-1">Alex is studying...</h2>
        <p className="text-xs text-gray-400 mb-4">Downloading 15m + 1h candles for {COINS.length} coins</p>
        <div className="bg-[#13131e] border border-white/[0.04] rounded-xl p-3 mb-3">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1.5"><span>{current || 'Starting...'}</span><span className="font-mono">{progress}%</span></div>
          <div className="h-1.5 bg-[#0a0a0f] rounded-full overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} /></div>
        </div>
        <div className="bg-[#0a0a0f] rounded-xl p-3 h-28 overflow-y-auto text-left space-y-0.5">{logs.map((l, i) => <p key={i} className="text-[10px] text-gray-500 font-mono">{l}</p>)}</div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center">
        <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-cyan-500 flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.3)] animate-pulse"><span className="text-3xl">🤖</span></div>
        <h1 className="text-xl font-bold text-white mb-1">Study the Market First</h1>
        <p className="text-xs text-gray-400 mb-6">Alex needs to analyze 15m + 1h candles. Trends, S/R, and volatility mapped per coin.</p>
        <div className="grid grid-cols-2 gap-2 mb-6">
          {[{ icon: <TrendingUp size={16} />, t: 'Trend Detection', d: 'EMA 9/20/50 on 15m + 1h' }, { icon: <Target size={16} />, t: 'Support & Resistance', d: 'Key S/R from 500 candles' }, { icon: <Activity size={16} />, t: 'Volatility', d: '14-period ATR per coin' }, { icon: <Clock size={16} />, t: 'Auto-refresh', d: 'Re-study every 4 hours' }].map((f, i) => (
            <div key={i} className="bg-[#13131e] border border-white/[0.04] rounded-xl p-3 text-left"><div className="text-blue-400 mb-1.5">{f.icon}</div><p className="text-xs font-semibold text-white">{f.t}</p><p className="text-[10px] text-gray-500">{f.d}</p></div>
          ))}
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={startStudy} className="px-7 py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold rounded-xl text-sm shadow-[0_0_30px_rgba(34,197,94,0.2)]"><BookOpen className="inline mr-2" size={18} /> Start Market Study</motion.button>
        <p className="text-[9px] text-gray-600 mt-2">Takes ~30 seconds. Auto-refreshes every 4 hours.</p>
      </motion.div>
    </div>
  );
}
