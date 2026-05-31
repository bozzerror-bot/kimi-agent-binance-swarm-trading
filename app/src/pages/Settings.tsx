import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { User, Brain, Settings2, Zap, Target, Clock, RefreshCw, Check, AlertTriangle, RotateCcw, Globe } from 'lucide-react';
import { COINS } from '../hooks/useBinancePrices';
import { useTradingStore } from '../store/tradingStore';

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

interface UserSettings {
  selectedCoins: string[];
  apiKey: string;
  apiSecret: string;
  testnet: boolean;
  autoTrade: boolean;
  riskPerTrade: number;
  maxPositions: number;
  leverage: number;
  stopLoss: number;
  takeProfit: number;
  timeframes: string[];
  personality: {
    riskTolerance: number;
    confidence: number;
    patience: number;
    adaptability: number;
  };
}

const defaultSettings: UserSettings = {
  selectedCoins: COINS.slice(0, 5),
  apiKey: '',
  apiSecret: '',
  testnet: true,
  autoTrade: false,
  riskPerTrade: 2,
  maxPositions: 3,
  leverage: 5,
  stopLoss: 1.5,
  takeProfit: 3,
  timeframes: ['5m', '15m', '1h'],
  personality: {
    riskTolerance: 0.72,
    confidence: 0.65,
    patience: 0.80,
    adaptability: 0.60,
  },
};

export default function Settings() {
  const setTradingEnabled = useTradingStore((s) => s.setTradingEnabled);
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('alex_settings');
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'trading' | 'personality' | 'api'>('general');

  const persist = useCallback((next: UserSettings) => {
    setSettings(next);
    localStorage.setItem('alex_settings', JSON.stringify(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  const toggleCoin = useCallback(
    (symbol: string) => {
      const next = {
        ...settings,
        selectedCoins: settings.selectedCoins.includes(symbol)
          ? settings.selectedCoins.filter((s) => s !== symbol)
          : [...settings.selectedCoins, symbol],
      };
      persist(next);
    },
    [settings, persist]
  );

  const updateField = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      persist({ ...settings, [key]: value });
    },
    [settings, persist]
  );

  const updatePersonality = useCallback(
    (key: keyof UserSettings['personality'], value: number) => {
      persist({
        ...settings,
        personality: { ...settings.personality, [key]: value },
      });
    },
    [settings, persist]
  );

  const resetAll = useCallback(() => {
    if (window.confirm('Reset all settings to defaults?')) {
      setSettings(defaultSettings);
      localStorage.removeItem('alex_settings');
    }
  }, []);

  const tabs = [
    { key: 'general' as const, label: 'General', icon: <Settings2 size={15} /> },
    { key: 'trading' as const, label: 'Trading', icon: <Zap size={15} /> },
    { key: 'personality' as const, label: 'Personality', icon: <Brain size={15} /> },
    { key: 'api' as const, label: 'API', icon: <Globe size={15} /> },
  ];

  return (
    <div className="min-h-[calc(100dvh-56px-40px)] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-sm text-[rgba(255,255,255,0.5)] mt-0.5">
              Configure Alex trading behaviour and API credentials
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1 text-xs font-medium text-[#2FFF6B]"
              >
                <Check size={13} /> Saved
              </motion.span>
            )}
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[rgba(255,255,255,0.5)] hover:text-white transition-colors"
              style={{ backgroundColor: '#13131F' }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: '#13131F' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex-1 justify-center"
              style={{
                backgroundColor: activeTab === t.key ? '#1E1E2D' : 'transparent',
                color: activeTab === t.key ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ─── General Tab ─── */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            {/* Coin Selection */}
            <motion.div
              custom={0}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="rounded-xl border p-5"
              style={{ backgroundColor: '#13131F', borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Target size={16} className="text-[#2FA3FF]" />
                <h3 className="text-sm font-semibold text-white">Active Coins</h3>
                <span className="text-xs text-[rgba(255,255,255,0.4)] ml-auto">
                  {settings.selectedCoins.length} selected
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-5 gap-2">
                {COINS.map((symbol) => {
                  const active = settings.selectedCoins.includes(symbol);
                  return (
                    <button
                      key={symbol}
                      onClick={() => toggleCoin(symbol)}
                      className="relative px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 border"
                      style={{
                        backgroundColor: active ? 'rgba(47,255,107,0.08)' : '#0C0C12',
                        borderColor: active ? 'rgba(47,255,107,0.25)' : 'rgba(255,255,255,0.06)',
                        color: active ? '#2FFF6B' : 'rgba(255,255,255,0.6)',
                      }}
                    >
                      {symbol.replace('USDT', '')}
                      {active && (
                        <Check
                          size={10}
                          className="absolute top-1 right-1"
                          style={{ color: '#2FFF6B' }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Timeframes */}
            <motion.div
              custom={1}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="rounded-xl border p-5"
              style={{ backgroundColor: '#13131F', borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Clock size={16} className="text-[#FFAA00]" />
                <h3 className="text-sm font-semibold text-white">Timeframes</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {['1m', '5m', '15m', '1h', '4h', '1d'].map((tf) => {
                  const active = settings.timeframes.includes(tf);
                  return (
                    <button
                      key={tf}
                      onClick={() =>
                        updateField(
                          'timeframes',
                          active
                            ? settings.timeframes.filter((t) => t !== tf)
                            : [...settings.timeframes, tf]
                        )
                      }
                      className="px-4 py-2 rounded-lg text-xs font-medium border transition-all duration-200"
                      style={{
                        backgroundColor: active ? 'rgba(255,170,0,0.08)' : '#0C0C12',
                        borderColor: active ? 'rgba(255,170,0,0.25)' : 'rgba(255,255,255,0.06)',
                        color: active ? '#FFAA00' : 'rgba(255,255,255,0.5)',
                      }}
                    >
                      {tf}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Auto-trade toggle */}
            <motion.div
              custom={2}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="rounded-xl border p-5 flex items-center justify-between"
              style={{ backgroundColor: '#13131F', borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-3">
                <RefreshCw size={16} className="text-[#2FA3FF]" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Auto-Trading</h3>
                  <p className="text-xs text-[rgba(255,255,255,0.4)]">
                    Allow Alex to execute trades automatically
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  const next = !settings.autoTrade;
                  updateField('autoTrade', next);
                  setTradingEnabled(next);
                }}
                className="relative w-11 h-6 rounded-full transition-colors duration-200"
                style={{
                  backgroundColor: settings.autoTrade ? '#2FFF6B' : 'rgba(255,255,255,0.12)',
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200"
                  style={{
                    transform: settings.autoTrade ? 'translateX(20px)' : 'translateX(0)',
                  }}
                />
              </button>
            </motion.div>
          </div>
        )}

        {/* ─── Trading Tab ─── */}
        {activeTab === 'trading' && (
          <div className="space-y-4">
            {(
              [
                {
                  key: 'riskPerTrade' as const,
                  label: 'Risk Per Trade',
                  desc: 'Maximum % of balance risked per trade',
                  icon: <AlertTriangle size={16} className="text-[#FF4444]" />,
                  min: 0.5,
                  max: 10,
                  step: 0.5,
                  unit: '%',
                },
                {
                  key: 'maxPositions' as const,
                  label: 'Max Positions',
                  desc: 'Maximum concurrent open positions',
                  icon: <Target size={16} className="text-[#2FA3FF]" />,
                  min: 1,
                  max: 10,
                  step: 1,
                  unit: '',
                },
                {
                  key: 'leverage' as const,
                  label: 'Leverage',
                  desc: 'Default leverage for futures trades',
                  icon: <Zap size={16} className="text-[#FFAA00]" />,
                  min: 1,
                  max: 125,
                  step: 1,
                  unit: 'x',
                },
                {
                  key: 'stopLoss' as const,
                  label: 'Stop Loss',
                  desc: 'Default stop loss distance %',
                  icon: <AlertTriangle size={16} className="text-[#FF4444]" />,
                  min: 0.5,
                  max: 10,
                  step: 0.5,
                  unit: '%',
                },
                {
                  key: 'takeProfit' as const,
                  label: 'Take Profit',
                  desc: 'Default take profit distance %',
                  icon: <Target size={16} className="text-[#2FFF6B]" />,
                  min: 1,
                  max: 20,
                  step: 0.5,
                  unit: '%',
                },
              ] as const
            ).map((field, i) => (
              <motion.div
                key={field.key}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="rounded-xl border p-5"
                style={{ backgroundColor: '#13131F', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  {field.icon}
                  <div>
                    <h3 className="text-sm font-semibold text-white">{field.label}</h3>
                    <p className="text-xs text-[rgba(255,255,255,0.4)]">{field.desc}</p>
                  </div>
                  <span className="ml-auto text-sm font-bold text-white">
                    {settings[field.key]}
                    {field.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={settings[field.key]}
                  onChange={(e) => updateField(field.key, parseFloat(e.target.value))}
                  className="w-full accent-[#2FA3FF]"
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── Personality Tab ─── */}
        {activeTab === 'personality' && (
          <div className="space-y-4">
            {(
              [
                {
                  key: 'riskTolerance' as const,
                  label: 'Risk Tolerance',
                  desc: 'Higher = more aggressive position sizing',
                  color: '#FF4444',
                },
                {
                  key: 'confidence' as const,
                  label: 'Confidence',
                  desc: 'Higher = takes more trades with lower confirmation',
                  color: '#2FA3FF',
                },
                {
                  key: 'patience' as const,
                  label: 'Patience',
                  desc: 'Higher = waits for better setups, fewer trades',
                  color: '#FFAA00',
                },
                {
                  key: 'adaptability' as const,
                  label: 'Adaptability',
                  desc: 'Higher = switches strategies faster on regime change',
                  color: '#2FFF6B',
                },
              ] as const
            ).map((trait, i) => (
              <motion.div
                key={trait.key}
                custom={i}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                className="rounded-xl border p-5"
                style={{ backgroundColor: '#13131F', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={16} style={{ color: trait.color }} />
                  <div>
                    <h3 className="text-sm font-semibold text-white">{trait.label}</h3>
                    <p className="text-xs text-[rgba(255,255,255,0.4)]">{trait.desc}</p>
                  </div>
                  <span className="ml-auto text-sm font-bold text-white">
                    {Math.round(settings.personality[trait.key] * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.personality[trait.key]}
                  onChange={(e) => updatePersonality(trait.key, parseFloat(e.target.value))}
                  className="w-full"
                  style={{ accentColor: trait.color }}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── API Tab ─── */}
        {activeTab === 'api' && (
          <div className="space-y-4">
            <motion.div
              custom={0}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="rounded-xl border p-5"
              style={{ backgroundColor: '#13131F', borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Globe size={16} className="text-[#2FA3FF]" />
                <h3 className="text-sm font-semibold text-white">Binance API Credentials</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[rgba(255,255,255,0.5)] mb-1.5">
                    API Key
                  </label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => updateField('apiKey', e.target.value)}
                    placeholder="Enter your Binance API key"
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-[rgba(255,255,255,0.25)] outline-none border focus:border-[rgba(47,163,255,0.4)] transition-colors"
                    style={{ backgroundColor: '#0C0C12', borderColor: 'rgba(255,255,255,0.08)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[rgba(255,255,255,0.5)] mb-1.5">
                    API Secret
                  </label>
                  <input
                    type="password"
                    value={settings.apiSecret}
                    onChange={(e) => updateField('apiSecret', e.target.value)}
                    placeholder="Enter your Binance API secret"
                    className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-[rgba(255,255,255,0.25)] outline-none border focus:border-[rgba(47,163,255,0.4)] transition-colors"
                    style={{ backgroundColor: '#0C0C12', borderColor: 'rgba(255,255,255,0.08)' }}
                  />
                </div>
              </div>
            </motion.div>

            {/* Testnet toggle */}
            <motion.div
              custom={1}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="rounded-xl border p-5 flex items-center justify-between"
              style={{ backgroundColor: '#13131F', borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-3">
                <User size={16} className="text-[#2FFF6B]" />
                <div>
                  <h3 className="text-sm font-semibold text-white">Testnet Mode</h3>
                  <p className="text-xs text-[rgba(255,255,255,0.4)]">
                    Use Binance testnet for paper trading
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateField('testnet', !settings.testnet)}
                className="relative w-11 h-6 rounded-full transition-colors duration-200"
                style={{
                  backgroundColor: settings.testnet ? '#2FFF6B' : 'rgba(255,255,255,0.12)',
                }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200"
                  style={{
                    transform: settings.testnet ? 'translateX(20px)' : 'translateX(0)',
                  }}
                />
              </button>
            </motion.div>

            <div
              className="rounded-xl border p-4 flex items-start gap-3"
              style={{
                backgroundColor: 'rgba(255,170,0,0.05)',
                borderColor: 'rgba(255,170,0,0.15)',
              }}
            >
              <AlertTriangle size={16} className="text-[#FFAA00] mt-0.5 shrink-0" />
              <p className="text-xs text-[rgba(255,255,255,0.5)] leading-relaxed">
                API keys are stored locally in your browser and are never sent to any server.
                Always use testnet mode when testing new strategies.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
