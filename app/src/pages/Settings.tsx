import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAlexStore, COINS } from '@/store/useAlexStore';
import { User, Brain, Zap, Target, Clock, RefreshCw, Key, Check, AlertTriangle, RotateCcw, Globe } from 'lucide-react';

export default function Settings() {
  const { settings, updateSettings, mood, resetAll } = useAlexStore();
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [apiSecret, setApiSecret] = useState(settings.apiSecret);
  const [conn, setConn] = useState<'idle'|'testing'|'success'|'error'>('idle');
  const [confirmReset, setConfirmReset] = useState(false);

  const testConn = async () => { setConn('testing'); try { const r = await fetch('https://testnet.binancefuture.com/fapi/v1/time'); setConn(r.ok ? 'success' : 'error'); if (r.ok) updateSettings({ apiKey, apiSecret }); } catch { setConn('error'); } };
  const toggleCoin = (sym: string) => { const next = settings.selectedCoins.includes(sym) ? settings.selectedCoins.filter(c => c !== sym) : [...settings.selectedCoins, sym]; updateSettings({ selectedCoins: next }); };

  return (
    <div className="min-h-screen pb-8 px-3 sm:px-4 max-w-[1440px] mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Settings</h1>
      <p className="text-xs sm:text-sm text-gray-500 mb-5">Configure Alex&apos;s personality, sizing, and API</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><User size={16} className="text-blue-400" /><h3 className="text-white font-semibold text-sm">Identity</h3></div>
          <label className="text-[10px] text-gray-400 mb-1 block">Name</label>
          <input type="text" value={settings.name} onChange={e => updateSettings({ name: e.target.value })} className="w-full bg-[#0a0a0f] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 focus:outline-none" />
          <div className="mt-3 flex items-center gap-2"><span className="text-xl">{mood === 'sharp' ? '⚡' : mood === 'focused' ? '🎯' : mood === 'confident' ? '💪' : mood === 'greedy' ? '🤑' : mood === 'frustrated' ? '😤' : mood === 'fearful' ? '😰' : '😐'}</span><span className="text-xs text-gray-400 capitalize">{mood}</span></div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><Brain size={16} className="text-purple-400" /><h3 className="text-white font-semibold text-sm">Personality</h3></div>
          {[{ k: 'riskTolerance', l: 'Risk', i: <Zap size={12} />, lo: 'Safe', hi: 'Aggro' }, { k: 'confidence', l: 'Confidence', i: <Target size={12} />, lo: 'Doubt', hi: 'Bold' }, { k: 'patience', l: 'Patience', i: <Clock size={12} />, lo: 'Fast', hi: 'Patient' }, { k: 'adaptability', l: 'Adapt', i: <RefreshCw size={12} />, lo: 'Stubborn', hi: 'Flexible' }].map(s => (
            <div key={s.k} className="mb-3">
              <div className="flex justify-between text-[10px] mb-1"><span className="text-gray-400 flex items-center gap-1">{s.i} {s.l}</span><span className="font-mono text-emerald-400">{(settings[s.k as keyof typeof settings] as number)}%</span></div>
              <input type="range" min={1} max={100} value={settings[s.k as keyof typeof settings] as number} onChange={e => updateSettings({ [s.k]: parseInt(e.target.value) })} className="w-full h-1 bg-[#0a0a0f] rounded-full appearance-none cursor-pointer accent-emerald-500" />
              <div className="flex justify-between text-[9px] text-gray-600 mt-0.5"><span>{s.lo}</span><span>{s.hi}</span></div>
            </div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><Brain size={16} className="text-emerald-400" /><h3 className="text-white font-semibold text-sm">Trading</h3></div>
          <label className="text-[10px] text-gray-400 mb-1 block">Entry Size (USDT)</label>
          <div className="flex gap-2 mb-3">
            {[100, 150, 200].map(sz => (
              <button key={sz} onClick={() => updateSettings({ entrySize: sz })} className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all ${settings.entrySize === sz ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-[#0a0a0f] text-gray-400 border border-white/[0.04]'}`}>${sz}</button>
            ))}
          </div>
          <label className="text-[10px] text-gray-400 mb-1 block">Leverage</label>
          <div className="flex gap-2 mb-3">
            {[10, 15, 20].map(l => (
              <button key={l} onClick={() => updateSettings({ maxLeverage: l })} className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${settings.maxLeverage === l ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-[#0a0a0f] text-gray-400 border border-white/[0.04]'}`}>{l}x</button>
            ))}
          </div>
          <label className="text-[10px] text-gray-400 mb-1 block">Interval</label>
          <div className="flex gap-2 mb-3">
            {['1m', '5m', '15m', '1h'].map(int => (
              <button key={int} onClick={() => updateSettings({ interval: int })} className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-all ${settings.interval === int ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-[#0a0a0f] text-gray-400 border border-white/[0.04]'}`}>{int}</button>
            ))}
          </div>
          <label className="text-[10px] text-gray-400 mb-1 block">Coins ({settings.selectedCoins.length}/20)</label>
          <div className="grid grid-cols-5 gap-1.5">
            {COINS.map(sym => (
              <button key={sym} onClick={() => toggleCoin(sym)} className={`flex items-center justify-between px-1.5 py-1 rounded-lg text-[9px] font-mono border transition-all ${settings.selectedCoins.includes(sym) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-[#0a0a0f] text-gray-600 border-white/[0.03]'}`}>{sym.replace('USDT', '')} {settings.selectedCoins.includes(sym) && <Check size={8} />}</button>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-[#13131e] border border-white/[0.04] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4"><Key size={16} className="text-yellow-400" /><h3 className="text-white font-semibold text-sm">Binance API</h3></div>
          <label className="text-[10px] text-gray-400 mb-1 block">API Key</label>
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Testnet API key" className="w-full bg-[#0a0a0f] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-yellow-500 focus:outline-none placeholder:text-gray-700 mb-2" />
          <label className="text-[10px] text-gray-400 mb-1 block">Secret</label>
          <input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} placeholder="API secret" className="w-full bg-[#0a0a0f] border border-white/[0.06] rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-yellow-500 focus:outline-none placeholder:text-gray-700 mb-3" />
          <div className="flex items-center gap-2 mb-2">
            <button onClick={testConn} disabled={conn === 'testing'} className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-[10px] font-semibold border border-yellow-500/30 disabled:opacity-50">{conn === 'testing' ? '...' : conn === 'success' ? 'Connected' : 'Test'}</button>
            <button onClick={() => updateSettings({ apiKey, apiSecret })} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-semibold border border-emerald-500/30">Save</button>
          </div>
          {conn === 'success' && <p className="text-[10px] text-emerald-400 flex items-center gap-1"><Check size={10} /> Connected</p>}
          {conn === 'error' && <p className="text-[10px] text-red-400">Failed</p>}
          <p className="text-[9px] text-gray-600 mt-2 flex items-center gap-1"><Globe size={8} /> <a href="https://testnet.binancefuture.com/" target="_blank" rel="noreferrer" className="text-blue-400 underline">testnet.binancefuture.com</a></p>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-5 bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3"><AlertTriangle size={14} className="text-red-400" /><h3 className="text-red-400 font-semibold text-xs">Danger</h3></div>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="flex items-center gap-2 px-3 py-2 bg-red-500/10 text-red-400 rounded-lg text-[10px] font-semibold border border-red-500/20 hover:bg-red-500/20"><RotateCcw size={12} /> Reset All</button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-red-400">Delete everything?</p>
            <button onClick={() => { resetAll(); setConfirmReset(false); }} className="px-3 py-1 bg-red-500 text-white rounded text-[10px] font-bold">Yes</button>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-1 bg-[#0a0a0f] text-gray-400 rounded text-[10px]">No</button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
