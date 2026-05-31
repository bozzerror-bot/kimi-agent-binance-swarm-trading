import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAlexStore } from '@/store/useAlexStore';
import { Download, BarChart3, X } from 'lucide-react';

function LSMarker({ side }: { side: 'LONG' | 'SHORT' }) {
  return <span className={`ls-marker ${side.toLowerCase()}`}>{side === 'LONG' ? 'L' : 'S'}</span>;
}
const stratColors: Record<string, string> = { BOS: 'bg-blue-500/20 text-blue-400', CHoCH: 'bg-purple-500/20 text-purple-400', TREND: 'bg-emerald-500/20 text-emerald-400', SCALP: 'bg-yellow-500/20 text-yellow-400' };

export default function Logs() {
  const { trades, positions, winCount, lossCount, totalPnl, strategyStats } = useAlexStore();
  const [sideF, setSideF] = useState<'ALL'|'LONG'|'SHORT'>('ALL');
  const [stratF, setStratF] = useState('ALL');
  const [symF, setSymF] = useState('ALL');
  const [tfF, setTfF] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expanded, setExpanded] = useState<string | null>(null);
  const symbols = useMemo(() => [...new Set(trades.map(t => t.symbol))], [trades]);
  const winRate = winCount + lossCount > 0 ? Math.round((winCount / (winCount + lossCount)) * 100) : 0;
  const openCount = positions.filter(p => p.status === 'open').length;

  const filtered = useMemo(() => {
    let t = [...trades];
    if (sideF !== 'ALL') t = t.filter(x => x.side === sideF);
    if (stratF !== 'ALL') t = t.filter(x => x.strategy === stratF);
    if (symF !== 'ALL') t = t.filter(x => x.symbol === symF);
    if (tfF !== 'ALL') t = t.filter(x => x.timeframe === tfF);
    return t;
  }, [trades, sideF, stratF, symF, tfF]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;

  const exportCSV = () => {
    const h = ['ID','Time','TF','Symbol','Side','Price','Size','Lev','Margin','P&L','Strategy','Status'];
    const r = filtered.map((t, i) => [i+1, t.time, t.timeframe, t.symbol, t.side, t.price, t.size, t.leverage, t.margin, t.pnl, t.strategy, t.status]);
    const csv = [h, ...r].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `alex-trades-${new Date().toISOString().split('T')[0]}.csv`; a.click();
  };

  return (
    <div className="min-h-screen pb-8 px-3 sm:px-4 max-w-[1440px] mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">Trading Logs</h1>
      <p className="text-xs text-gray-500 mb-4">Real trade history from Alex&apos;s SMC + Trend decisions</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[{ l: 'Total Trades', v: trades.length }, { l: 'Win Rate', v: `${winRate}%` }, { l: 'Total P&L', v: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, c: totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400' }, { l: 'Open', v: openCount }].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-[#13131e] border border-white/[0.04] rounded-xl p-3">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">{s.l}</p><p className={`text-xl font-mono font-bold ${s.c || 'text-white'}`}>{s.v}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        {['BOS', 'CHoCH', 'TREND', 'SCALP'].map(strat => {
          const st = strategyStats[strat] || { wins: 0, losses: 0, totalPnl: 0, winRate: 0 };
          return (
            <div key={strat} className="bg-[#13131e] border border-white/[0.04] rounded-xl px-3 py-2">
              <div className="flex justify-between items-center mb-1"><span className="text-[10px] font-bold text-gray-400">{strat}</span><span className={`text-[10px] font-mono font-bold ${st.winRate >= 50 ? 'text-emerald-400' : 'text-gray-500'}`}>{st.winRate}% WR</span></div>
              <div className="h-1 bg-[#0a0a0f] rounded-full overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500" style={{ width: `${st.winRate}%` }} /></div>
              <p className="text-[8px] text-gray-600 mt-1 font-mono">{st.wins + st.losses}T · ${st.totalPnl.toFixed(0)}</p>
            </div>
          );
        })}
      </div>

      {trades.length === 0 ? (
        <div className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-12 text-center"><BarChart3 size={28} className="mx-auto text-gray-700 mb-2" /><p className="text-gray-500 text-sm">No trades yet</p><p className="text-gray-700 text-xs mt-1">Enable trading on the Dashboard</p></div>
      ) : (
        <>
          <div className="bg-[#13131e] border border-white/[0.04] rounded-xl p-3 mb-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">{(['ALL','LONG','SHORT'] as const).map(f => (
                <button key={f} onClick={() => setSideF(f)} className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all ${sideF === f ? f === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : f === 'SHORT' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{f}</button>
              ))}</div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex gap-1">{['ALL','BOS','CHoCH','TREND','SCALP'].map(f => (
                <button key={f} onClick={() => setStratF(f)} className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all ${stratF === f ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{f}</button>
              ))}</div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex gap-1">{['ALL','1m','5m','15m','1h'].map(f => (
                <button key={f} onClick={() => setTfF(f)} className={`px-2 py-1 rounded-lg text-[10px] font-mono transition-all ${tfF === f ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{f}</button>
              ))}</div>
              <select value={symF} onChange={e => setSymF(e.target.value)} className="bg-[#0a0a0f] border border-white/[0.04] rounded-lg px-2 py-1 text-[10px] text-white font-mono"><option value="ALL">All</option>{symbols.map(s => <option key={s} value={s}>{s.replace('USDT', '')}</option>)}</select>
              <div className="flex-1" />
              <button onClick={exportCSV} className="flex items-center gap-1 px-2.5 py-1.5 bg-white/5 text-gray-400 rounded-lg text-[10px] hover:bg-white/10 transition-all"><Download size={10} /> CSV</button>
            </div>
            {(sideF !== 'ALL' || stratF !== 'ALL' || symF !== 'ALL' || tfF !== 'ALL') && (
              <button onClick={() => { setSideF('ALL'); setStratF('ALL'); setSymF('ALL'); setTfF('ALL'); }} className="text-[10px] text-gray-500 hover:text-gray-300 flex items-center gap-1"><X size={8} /> Clear</button>
            )}
          </div>

          <div className="bg-[#13131e] border border-white/[0.04] rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] sm:text-xs">
                <thead><tr className="text-gray-500 text-left border-b border-white/[0.04]">
                  <th className="px-3 py-2.5 font-medium">L/S</th><th className="px-3 py-2.5 font-medium">Time</th><th className="px-3 py-2.5 font-medium">TF</th>
                  <th className="px-3 py-2.5 font-medium">Sym</th><th className="px-3 py-2.5 font-medium">Side</th><th className="px-3 py-2.5 font-medium">Price</th>
                  <th className="px-3 py-2.5 font-medium">Size</th><th className="px-3 py-2.5 font-medium">Lev</th><th className="px-3 py-2.5 font-medium">P&L</th>
                  <th className="px-3 py-2.5 font-medium">Strat</th><th className="px-3 py-2.5 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {paged.map(t => (
                    <><tr key={t.id} onClick={() => setExpanded(expanded === t.id ? null : t.id)} className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors">
                      <td className="px-3 py-2"><LSMarker side={t.side} /></td>
                      <td className="px-3 py-2 font-mono text-gray-400">{t.time}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{t.timeframe}</td>
                      <td className="px-3 py-2 font-mono font-semibold text-white">{t.symbol.replace('USDT', '')}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${t.side === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{t.side}</span></td>
                      <td className="px-3 py-2 font-mono text-white">${t.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td className="px-3 py-2 font-mono text-gray-400">{t.size}</td>
                      <td className="px-3 py-2 font-mono text-purple-400">{t.leverage}x</td>
                      <td className={`px-3 py-2 font-mono font-bold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}</td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${stratColors[t.strategy] || 'bg-gray-500/20 text-gray-400'}`}>{t.strategy}</span></td>
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[9px] ${t.status === 'open' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>{t.status}</span></td>
                    </tr>
                    {expanded === t.id && (
                      <tr className="bg-[#0a0a0f]"><td colSpan={11} className="px-3 py-2.5">
                        <div className="text-[10px] text-gray-400 space-y-0.5">
                          <p><span className="text-gray-600">Entry:</span> ${t.price.toLocaleString()} | <span className="text-gray-600">Margin:</span> ${t.margin.toFixed(2)} | <span className="text-gray-600">Regime:</span> {t.regime} | <span className="text-gray-600">TF:</span> {t.timeframe}</p>
                          {t.closePrice && <p><span className="text-gray-600">Exit:</span> ${t.closePrice.toLocaleString()} ({t.closeReason})</p>}
                          <p className="italic text-gray-600">&quot;{t.reasoning}&quot;</p>
                        </div>
                      </td></tr>
                    )}</>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 border-t border-white/[0.04]">
              <p className="text-[10px] text-gray-500">{filtered.length} trades</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-2 py-1 rounded text-[10px] text-gray-400 hover:text-white disabled:opacity-30">Prev</button>
                <span className="text-[10px] font-mono text-gray-400">{page}/{totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-2 py-1 rounded text-[10px] text-gray-400 hover:text-white disabled:opacity-30">Next</button>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="bg-[#0a0a0f] border border-white/[0.04] rounded px-1 py-0.5 text-[9px] text-gray-400 font-mono ml-1">{[10, 25, 50].map(n => <option key={n} value={n}>{n}/p</option>)}</select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
