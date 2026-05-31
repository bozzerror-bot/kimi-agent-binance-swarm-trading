import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Power, Activity, Brain, TrendingUp, Lock, BookOpen, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAlexStore } from '@/store/useAlexStore';

function CountNum({ value, d = 0 }: { value: number; d?: number }) {
  const [n, setN] = useState(0); const r = useRef<number | null>(null);
  useEffect(() => { r.current = null; let af: number;
    const step = (ts: number) => { if (!r.current) r.current = ts; const p = Math.min((ts - r.current) / 800, 1); setN(v => v + (value - v) * (1 - Math.pow(1 - p, 3))); if (p < 1) af = requestAnimationFrame(step); };
    af = requestAnimationFrame(step); return () => cancelAnimationFrame(af);
  }, [value]);
  return <>{d > 0 ? n.toFixed(d) : Math.round(n).toLocaleString()}</>;
}

function ReasoningText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return <>{parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="text-emerald-400">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)}</>;
}

function AlexAvatar({ mood, size = 44 }: { mood: string; size?: number }) {
  const mouth = mood === 'confident' || mood === 'focused' ? 'happy' : mood === 'fearful' || mood === 'frustrated' ? 'sad' : 'neutral';
  return (
    <div className="relative">
      <div className={`alex-head alex-mood-${mood}`} style={{ width: size, height: size }}>
        <div className="alex-eyes" style={{ gap: size * 0.13, marginTop: size * 0.2 }}>
          <div className="alex-eye" style={{ width: size * 0.12, height: size * 0.15, animation: 'blink 4s ease-in-out infinite' }}><div style={{ width: size * 0.055, height: size * 0.055, background: '#0a0a0f', borderRadius: '50%', margin: '1px auto 0' }} /></div>
          <div className="alex-eye" style={{ width: size * 0.12, height: size * 0.15, animation: 'blink 4s ease-in-out infinite', animationDelay: '0.1s' }}><div style={{ width: size * 0.055, height: size * 0.055, background: '#0a0a0f', borderRadius: '50%', margin: '1px auto 0' }} /></div>
        </div>
        <div className={`alex-mouth alex-mouth-${mouth}`} style={{ marginTop: size * 0.05 }} />
      </div>
      <div className="jarvis-ring" />
      <div className={`alex-status ${mood === 'focused' ? 'trading' : mood === 'fearful' ? 'stressed' : 'analyzing'}`} />
    </div>
  );
}

function RadarScan() {
  return (
    <div className="radar-container">
      <div className="radar-ring" /><div className="radar-ring" /><div className="radar-ring" />
      <div className="radar-sweep" />
      <div className="radar-dot" style={{ top: '20%', left: '60%' }} />
      <div className="radar-dot" style={{ top: '70%', left: '30%', animationDelay: '0.5s' }} />
      <div className="radar-dot" style={{ top: '45%', left: '75%', animationDelay: '1s' }} />
    </div>
  );
}

function LSMarker({ side }: { side: 'LONG' | 'SHORT' }) {
  return <span className={`ls-marker ${side.toLowerCase()}`}>{side === 'LONG' ? 'L' : 'S'}</span>;
}

const moodText: Record<string, string> = { sharp: 'Riding high', focused: 'In the zone', cautious: 'Being careful', hesitant: 'Hesitating', fearful: 'Protective mode', greedy: 'Pushing bigger', frustrated: 'Taking a break', confident: 'Trusting the process', neutral: 'Calm & balanced' };

export default function Dashboard() {
  const marketStudyComplete = useAlexStore(s => s.marketStudyComplete);
  const s = useAlexStore();
  const logRef = useRef<HTMLDivElement>(null);
  const open = s.positions.filter(p => p.status === 'open');
  const real = s.coins.some(c => c.isReal && c.price > 0);
  const top4 = [...s.coins].sort((a, b) => b.volume24h - a.volume24h).slice(0, 4);
  const recent = s.trades.slice(0, 5);

  useEffect(() => { logRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [s.reasoning.length]);

  const TrendArrow = ({ sym }: { sym: string }) => {
    const t = s.marketStudyData[sym]?.trendDirection;
    if (t === 'uptrend') return <span className="trend-arrow text-emerald-400">&#8593;</span>;
    if (t === 'downtrend') return <span className="trend-arrow text-red-400">&#8595;</span>;
    return <span className="trend-arrow text-gray-500">&#8594;</span>;
  };

  return (
    <div className="min-h-screen pb-8 px-3 sm:px-4 max-w-[1440px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <AlexAvatar mood={s.mood} size={42} />
          <div>
            <p className="text-white font-semibold text-xs sm:text-sm">{s.settings.name} <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1 py-0.5 rounded ml-1">FUTURES</span></p>
            <p className="text-[11px] text-gray-500">{moodText[s.mood] || 'Analyzing...'}</p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => s.updateSettings({ tradingEnabled: !s.settings.tradingEnabled })} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all ${s.settings.tradingEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
          <Power size={14} className={s.settings.tradingEnabled ? 'animate-pulse' : ''} />{s.settings.tradingEnabled ? 'TRADING ON' : 'TRADING OFF'}
        </motion.button>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${real ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-yellow-500/30 bg-yellow-500/10'}`}>
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${real ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
            <span className={`text-[10px] font-mono font-semibold ${real ? 'text-emerald-400' : 'text-yellow-400'}`}>{real ? 'LIVE' : '...'}</span>
          </div>
          <span className="text-[10px] font-mono text-gray-600">#{s.cycle}</span>
        </div>
      </div>

      {s.reasoning.length > 0 ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="speech-bubble mb-4 ml-12 max-w-md">
          <p className="text-xs text-gray-300 leading-relaxed"><ReasoningText text={s.reasoning[0].text} /></p>
          <span className="text-[9px] text-gray-600 mt-1 block font-mono">{s.reasoning[0].time} · {s.reasoning[0].strategy} · {Math.round(s.reasoning[0].confidence * 100)}% conf</span>
        </motion.div>
      ) : (
        <div className="speech-bubble mb-4 ml-12 max-w-xs">
          <div className="typing"><span className="text-[11px] text-gray-500 mr-2">Alex is scanning</span><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-4">
          <h3 className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Portfolio</h3>
          <p className="text-2xl sm:text-3xl font-mono font-bold text-white">$<CountNum value={10000 + s.totalPnl} d={2} /></p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[{ l: 'Positions', v: open.length }, { l: 'W/L', v: `${s.winCount}/${s.lossCount}` }, { l: 'P&L', v: `${s.totalPnl >= 0 ? '+' : ''}$${s.totalPnl.toFixed(2)}`, color: s.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' }, { l: 'Size', v: `$${s.settings.entrySize}` }].map((item, i) => (
              <div key={i} className="bg-[#0a0a0f] rounded-lg p-2.5"><p className="text-[9px] text-gray-600 uppercase">{item.l}</p><p className={`text-lg font-mono font-bold ${item.color || 'text-white'}`}>{item.v}</p></div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-4">
          <h3 className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Agent State</h3>
          <div className="flex items-center gap-2.5 mb-3">
            <AlexAvatar mood={s.mood} size={32} />
            <div><p className="text-white font-semibold text-sm capitalize">{s.mood}</p><p className="text-[10px] text-gray-500">{moodText[s.mood]}</p></div>
          </div>
          <div className="space-y-2.5">
            <div><div className="flex justify-between text-[10px] mb-1"><span className="text-gray-500">Stress</span><span className="font-mono text-gray-400">{Math.round(s.stressLevel * 100)}%</span></div>
              <div className="h-1 bg-[#0a0a0f] rounded-full overflow-hidden"><motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-red-500" animate={{ width: `${s.stressLevel * 100}%` }} transition={{ duration: 0.5 }} /></div>
            </div>
            <div className="flex items-center gap-1.5"><Brain size={12} className="text-blue-400" /><span className="text-[10px] text-gray-400">Strat: <span className="text-blue-400 font-semibold">SMC + Trend</span></span></div>
            <div className="flex items-center gap-1.5"><Activity size={12} className="text-purple-400" /><span className="text-[10px] text-gray-400">Max: <span className="text-purple-400 font-semibold">{s.settings.maxLeverage}x</span></span></div>
            <div className="flex items-center gap-1.5">
              {!marketStudyComplete ? <Link to="/study" className="text-[10px] text-yellow-400 flex items-center gap-1 hover:underline"><BookOpen size={10} /> Study required</Link>
                : <span className="text-[10px] text-emerald-400 flex items-center gap-1"><TrendingUp size={10} /> Study active</span>}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-4">
          <h3 className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Market</h3>
          <div className="space-y-2.5">
            {top4.map(c => {
              const study = s.marketStudyData[c.symbol];
              return (
                <div key={c.symbol} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <TrendArrow sym={c.symbol} />
                    <span className="text-[11px] font-semibold text-white w-10">{c.symbol.replace('USDT', '')}</span>
                    {study && <span className="text-[8px] text-gray-600 font-mono hidden sm:inline">S:{Math.round(study.supportLevels[0] || 0).toLocaleString()} R:{Math.round(study.resistanceLevels[0] || 0).toLocaleString()}</span>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs sm:text-sm font-mono font-bold text-white">{c.price > 0 ? `$${c.price.toLocaleString(undefined, { minimumFractionDigits: c.price < 1 ? 4 : c.price < 100 ? 2 : 0 })}` : '---'}</p>
                    <p className={`text-[9px] font-mono ${c.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(2)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        {['BOS', 'CHoCH', 'TREND', 'SCALP'].map(strat => {
          const st = s.strategyStats[strat] || { wins: 0, losses: 0, winRate: 0, totalPnl: 0 };
          return (
            <div key={strat} className="bg-[#13131e] border border-white/[0.04] rounded-xl px-3 py-2">
              <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-semibold text-gray-400">{strat}</span><span className={`text-[10px] font-mono font-bold ${st.winRate >= 50 ? 'text-emerald-400' : 'text-gray-500'}`}>{st.winRate}%</span></div>
              <div className="h-1 bg-[#0a0a0f] rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all" style={{ width: `${st.winRate}%` }} /></div>
              <p className="text-[8px] text-gray-600 mt-1 font-mono">{st.wins + st.losses} trades</p>
            </div>
          );
        })}
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-4 mb-3 relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">Open Positions ({open.length})</h3>
          {s.settings.tradingEnabled && marketStudyComplete && (
            <div className="flex items-center gap-2">
              <RadarScan />
              <span className="text-[9px] text-emerald-500 animate-pulse">Scanning</span>
              <span className="text-[8px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">BOS + CHoCH + Trend</span>
            </div>
          )}
        </div>
        <AnimatePresence>
          {!marketStudyComplete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="study-lock-overlay rounded-2xl">
              <Lock size={20} className="text-gray-500 mb-1" />
              <p className="text-gray-400 text-xs font-semibold">Complete Market Study to Trade</p>
              <Link to="/study" className="mt-2 px-3 py-1.5 bg-emerald-500 text-black font-bold rounded-lg text-[10px] inline-flex items-center gap-1 hover:bg-emerald-400 transition-colors"><BookOpen size={12} /> Start Study</Link>
            </motion.div>
          )}
        </AnimatePresence>
        {open.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-600 text-xs">No open positions</p>
            <p className="text-gray-700 text-[10px] mt-1">{s.settings.tradingEnabled ? 'Alex is scanning 15m + 1h for SMC setups...' : 'Enable trading to start'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[10px] sm:text-xs">
              <thead><tr className="text-gray-500 text-left"><th className="pb-2">L/S</th><th className="pb-2">Sym</th><th className="pb-2">Entry</th><th className="pb-2">Size</th><th className="pb-2">Lev</th><th className="pb-2">P&L</th><th className="pb-2">Strat</th><th className="pb-2">TF</th></tr></thead>
              <tbody>{open.map(p => (
                <tr key={p.id} className="border-t border-white/[0.03]">
                  <td className="py-1.5"><LSMarker side={p.side} /></td>
                  <td className="py-1.5 font-mono font-semibold text-white">{p.symbol.replace('USDT', '')}</td>
                  <td className="py-1.5 font-mono text-gray-400">${p.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td className="py-1.5 font-mono text-gray-400">{p.size}</td>
                  <td className="py-1.5 font-mono text-purple-400">{p.leverage}x</td>
                  <td className={`py-1.5 font-mono font-bold ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}</td>
                  <td className="py-1.5"><span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-500/20 text-blue-400">{p.strategy}</span></td>
                  <td className="py-1.5 font-mono text-gray-500">{p.timeframe}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-4">
          <h3 className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">P&L</h3>
          {s.pnlHistory.length === 0 ? <div className="text-center py-10 text-gray-600 text-xs">No data yet</div> : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={s.pnlHistory}>
                <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.08)" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }} />
                <YAxis stroke="rgba(255,255,255,0.08)" tick={{ fontSize: 9, fontFamily: 'JetBrains Mono' }} tickFormatter={(v: number) => `$${v}`} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => [`$${(v as number).toFixed(2)}`, 'P&L']} />
                <Area type="monotone" dataKey="pnl" stroke="#22c55e" strokeWidth={2} fill="url(#pg)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-4">
          <h3 className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Alex&apos;s Thoughts</h3>
          <div ref={logRef} className="h-[180px] overflow-y-auto pr-1 space-y-1.5">
            {s.reasoning.length === 0 ? <p className="text-gray-600 text-xs text-center py-8">Scanning 15m + 1h for SMC signals...</p> : s.reasoning.slice(0, 15).map((r, i) => (
              <div key={i} className="flex gap-1.5 text-[10px]">
                <span className="font-mono text-gray-600 shrink-0">{r.time}</span>
                <span className={`shrink-0 px-1 rounded-[3px] text-[8px] ${r.type === 'trade' ? 'bg-emerald-500/20 text-emerald-400' : r.type === 'close' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>{r.type}</span>
                <span className="text-gray-400 shrink-0">{r.symbol?.replace('USDT', '')}</span>
                <span className="text-gray-300 italic"><ReasoningText text={r.text} /></span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-4 mb-3">
        <h3 className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-3">Recent Trades</h3>
        {recent.length === 0 ? <p className="text-gray-600 text-xs text-center py-4">No trades yet</p> : (
          <div className="space-y-1.5">
            {recent.map((t, i) => (
              <div key={i} className="flex items-center justify-between bg-[#0a0a0f] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <LSMarker side={t.side} />
                  <span className="font-mono text-[9px] text-gray-500">{t.time}</span>
                  <span className="text-[11px] font-semibold text-white">{t.symbol.replace('USDT', '')}</span>
                  <span className="text-[9px] font-mono text-gray-500">{t.timeframe}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-gray-400">${t.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">{t.strategy}</span>
                  <span className={`text-[11px] font-mono font-bold ${(t.pnl || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{(t.pnl || 0) >= 0 ? '+' : ''}${(t.pnl || 0).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider">20 Futures Markets</h3>
          <Link to="/chart" className="text-[9px] text-blue-400 flex items-center gap-1 hover:underline"><BarChart3 size={10} /> View Charts</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {s.coins.map(c => {
            const study = s.marketStudyData[c.symbol];
            const td = study?.trendDirection;
            return (
              <div key={c.symbol} className={`bg-[#0a0a0f] rounded-xl p-2.5 border ${s.settings.selectedCoins.includes(c.symbol) ? 'border-emerald-500/15' : 'border-white/[0.03]'} ${!c.isReal ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-semibold text-white">{c.symbol.replace('USDT', '')}</span>
                  <div className="flex items-center gap-1">
                    {td && <span className={`text-[8px] font-bold px-1 rounded ${td === 'uptrend' ? 'bg-emerald-500/20 text-emerald-400' : td === 'downtrend' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>{td === 'uptrend' ? '↗' : td === 'downtrend' ? '↘' : '→'}</span>}
                    {c.change24h !== 0 && <span className={`text-[9px] font-mono ${c.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(1)}%</span>}
                  </div>
                </div>
                <p className="text-sm font-mono font-bold text-white">{c.price > 0 ? `$${c.price.toLocaleString(undefined, { minimumFractionDigits: c.price < 1 ? 4 : c.price < 100 ? 2 : 0 })}` : '---'}</p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
