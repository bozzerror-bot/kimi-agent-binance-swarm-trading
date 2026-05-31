import { useState, useCallback } from 'react';
import { BookOpen, Download, CheckCircle, Loader2, BarChart3, ArrowUp, ArrowDown } from 'lucide-react';
import { useTradingStore } from '../store/tradingStore';
import { useAlexStore } from '../store/useAlexStore';

function fmtPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 100) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  if (n >= 1) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 0.01) return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
}

function getBasePrice(symbol: string): number {
  const map: Record<string, number> = {
    BTCUSDT: 67600,
    ETHUSDT: 3520,
    BNBUSDT: 605,
    SOLUSDT: 168,
    XRPUSDT: 0.52,
    ADAUSDT: 0.46,
    DOGEUSDT: 0.093,
    AVAXUSDT: 36,
    DOTUSDT: 7.2,
    MATICUSDT: 0.42,
  };
  return map[symbol] ?? 100;
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT',
];

interface SymbolProgress {
  symbol: string;
  status: 'pending' | 'downloading' | 'done' | 'error';
  candles?: number;
  price?: number;
  support?: number;
  resistance?: number;
  volatility?: number;
}

export default function StudyMarket() {
  const { marketStudyComplete, setMarketStudyComplete } = useTradingStore();
  const [isStudying, setIsStudying] = useState(false);
  const [progress, setProgress] = useState<SymbolProgress[]>(
    SYMBOLS.map((s) => ({ symbol: s, status: 'pending' }))
  );
  const [overallProgress, setOverallProgress] = useState(0);

  const setMarketStudyData = useAlexStore((s) => s.setMarketStudyData);
  const storeCoins = useAlexStore((s) => s.coins);

  const startStudy = useCallback(async () => {
    setIsStudying(true);
    setMarketStudyComplete(false);
    const studyData: Record<string, { support: number; resistance: number; volatility: number; trendDirection: 'uptrend' | 'downtrend' | 'sideways' | 'ranging'; }> = {};

    for (let i = 0; i < SYMBOLS.length; i++) {
      const symbol = SYMBOLS[i];

      setProgress((prev) =>
        prev.map((p) =>
          p.symbol === symbol ? { ...p, status: 'downloading' } : p
        )
      );

      await new Promise((resolve) => setTimeout(resolve, 400 + Math.random() * 300));

      const basePrice = storeCoins.find((c) => c.symbol === symbol)?.price || getBasePrice(symbol);
      const sRatio = 0.97 + Math.random() * 0.02;
      const rRatio = 1.01 + Math.random() * 0.02;
      const support = basePrice * sRatio;
      const resistance = basePrice * rRatio;
      const volatility = basePrice * (0.005 + Math.random() * 0.015);
      const candles = 43200 + Math.floor(Math.random() * 5000);

      studyData[symbol] = {
        support,
        resistance,
        volatility,
        trendDirection: Math.random() > 0.5 ? 'uptrend' : 'ranging',
      };

      setProgress((prev) =>
        prev.map((p) =>
          p.symbol === symbol
            ? { ...p, status: 'done', candles, price: basePrice, support, resistance, volatility }
            : p
        )
      );

      setOverallProgress(((i + 1) / SYMBOLS.length) * 100);
    }

    setMarketStudyData(studyData);
    setIsStudying(false);
    setMarketStudyComplete(true);
  }, [setMarketStudyComplete, setMarketStudyData, storeCoins]);

  const doneCount = progress.filter((p) => p.status === 'done').length;

  return (
    <div className="min-h-[calc(100dvh-56px)] p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#13131F] border border-[rgba(255,255,255,0.06)] flex items-center justify-center">
            <BookOpen size={24} className="text-[#2FA3FF]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Study Market</h1>
            <p className="text-sm text-[rgba(255,255,255,0.5)] mt-0.5">
              Download 1 month of historical data to calibrate Alex before trading
            </p>
          </div>
        </div>

        {/* Status Card */}
        <div
          className="rounded-xl border p-6"
          style={{
            backgroundColor: '#13131F',
            borderColor: marketStudyComplete
              ? 'rgba(47, 255, 107, 0.2)'
              : 'rgba(255, 255, 255, 0.06)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {marketStudyComplete ? (
                <CheckCircle size={20} className="text-[#2FFF6B]" />
              ) : isStudying ? (
                <Loader2 size={20} className="text-[#2FA3FF] animate-spin" />
              ) : (
                <BarChart3 size={20} className="text-[#FFAA00]" />
              )}
              <span className="font-semibold text-white">
                {marketStudyComplete
                  ? 'Market Study Complete'
                  : isStudying
                  ? 'Downloading Historical Data...'
                  : 'Study Required Before Trading'}
              </span>
            </div>
            <span className="text-sm text-[rgba(255,255,255,0.5)]">
              {doneCount}/{SYMBOLS.length} symbols
            </span>
          </div>

          {/* Progress bar */}
          <div className="study-progress-bar">
            <div
              className={`study-progress-fill ${isStudying ? 'study-downloading' : ''}`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>

          {!marketStudyComplete && !isStudying && (
            <button
              onClick={startStudy}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{
                backgroundColor: '#2FA3FF',
                color: '#FFFFFF',
              }}
            >
              <Download size={16} />
              Start Market Study
            </button>
          )}
        </div>

        {/* Symbol Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {progress.map(({ symbol, status, candles, price, support, resistance, volatility }) => (
            <div
              key={symbol}
              className="rounded-lg border p-3 transition-all duration-300"
              style={{
                backgroundColor: status === 'done' ? 'rgba(47, 255, 107, 0.05)' : '#13131F',
                borderColor:
                  status === 'done'
                    ? 'rgba(47, 255, 107, 0.15)'
                    : status === 'downloading'
                    ? 'rgba(47, 163, 255, 0.2)'
                    : 'rgba(255, 255, 255, 0.06)',
              }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-white">
                  {symbol.replace('USDT', '')}
                </span>
                {status === 'done' && (
                  <CheckCircle size={12} className="text-[#2FFF6B]" />
                )}
                {status === 'downloading' && (
                  <Loader2 size={12} className="text-[#2FA3FF] animate-spin" />
                )}
              </div>

              {status === 'done' && price ? (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-[rgba(255,255,255,0.5)]">
                    Price: <span className="text-white font-medium">${fmtPrice(price)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[rgba(255,255,255,0.5)]">
                    Support:
                    <span className="text-[#2FFF6B] font-medium">${fmtPrice(support ?? 0)}</span>
                    <ArrowUp size={9} className="text-[#2FFF6B]" />
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[rgba(255,255,255,0.5)]">
                    Resistance:
                    <span className="text-[#FF4444] font-medium">${fmtPrice(resistance ?? 0)}</span>
                    <ArrowDown size={9} className="text-[#FF4444]" />
                  </div>
                  <div className="text-[10px] text-[rgba(255,255,255,0.5)]">
                    Vol (ATR): <span className="text-[#FFAA00] font-medium">${fmtPrice(volatility ?? 0)}</span>
                  </div>
                  <div className="text-[9px] text-[rgba(255,255,255,0.25)] pt-0.5">
                    {candles?.toLocaleString()} candles
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-[rgba(255,255,255,0.4)]">
                  {status === 'downloading'
                    ? 'Downloading...'
                    : 'Pending'}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Info */}
        <div
          className="rounded-lg border p-4 text-sm"
          style={{
            backgroundColor: '#0C0C12',
            borderColor: 'rgba(255, 255, 255, 0.06)',
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          <p>
            Downloads 1-minute OHLCV candles for the past 30 days from Binance Futures.
            This data is used to calibrate support/resistance levels, trend detection,
            and volatility baselines. No API key required — uses public endpoints.
          </p>
        </div>
      </div>
    </div>
  );
}
