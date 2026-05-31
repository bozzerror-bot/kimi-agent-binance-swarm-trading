import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Power,
  Activity,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Lock,
  OctagonAlert,
  Target,
  BarChart3,
  ChevronUp,
  ChevronDown,
  Zap,
  Shield,
  Radio,
  CircleDot,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { useLiveTrading, COINS } from '../hooks/useLiveTrading';
import { useTradingStore } from '@/store/useTradingStore';
import {
  agentState,
  portfolio,
  pnlHistory,
  pnlHistory1D,
  pnlHistory30D,
} from '../data/mockData';
import type { Trade, Position } from '../data/mockData';

/* ═══════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════ */
const STRATEGY_COLORS: Record<string, string> = {
  mean_reversion: '#2FA3FF',
  trend_following: '#2FFF6B',
  breakout: '#FFAA00',
  vwap_scalp: '#FF6B9D',
};

const REGIME_COLORS: Record<string, string> = {
  trending: '#2FFF6B',
  ranging: '#2FA3FF',
  volatile: '#FFAA00',
  mixed: 'rgba(255,255,255,0.50)',
};

const REGIME_BG: Record<string, string> = {
  trending: 'rgba(47, 255, 107, 0.10)',
  ranging: 'rgba(47, 163, 255, 0.10)',
  volatile: 'rgba(255, 170, 0, 0.10)',
  mixed: 'rgba(255, 255, 255, 0.06)',
};

const MOOD_EMOJI: Record<string, string> = {
  neutral: '😐',
  focused: '🎯',
  confident: '🚀',
  fearful: '😰',
  greedy: '🤑',
  sharp: '⚡',
  cautious: '🛡️',
};

const MOOD_LABEL: Record<string, string> = {
  neutral: 'Neutral',
  focused: 'Focused',
  confident: 'Confident',
  fearful: 'Fearful',
  greedy: 'Greedy',
  sharp: 'Sharp',
  cautious: 'Cautious',
};

/* ═══════════════════════════════════════════════════════════
   ANIMATED NUMBER COUNTER (requestAnimationFrame)
   ═══════════════════════════════════════════════════════════ */
function useCountUp(end: number, duration = 1000, delay = 0) {
  const [value, setValue] = useState(0);
  const startTime = useRef<number | null>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = (timestamp: number) => {
        if (startTime.current === null) startTime.current = timestamp;
        const elapsed = timestamp - startTime.current;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(eased * end);
        if (progress < 1) {
          rafId.current = requestAnimationFrame(animate);
        }
      };
      rafId.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [end, duration, delay]);

  return value;
}

function CountNum({ value, prefix = '', suffix = '', decimals = 2, delay = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number; delay?: number;
}) {
  const animated = useCountUp(value, 1000, delay);
  return <span>{prefix}{animated.toFixed(decimals)}{suffix}</span>;
}

function formatMoney(value: number): string {
  const absVal = Math.abs(value);
  if (absVal >= 1000) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (absVal >= 1) return value.toFixed(2);
  return value.toFixed(4);
}

function formatTime(iso?: string): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

/* ═══════════════════════════════════════════════════════════
   FORMAT REASONING — Parse **bold** and *italic* markup
   ═══════════════════════════════════════════════════════════ */
function formatReasoningText(text: string): React.ReactNode {
  // Split on **bold** and *italic* patterns
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  // Simple regex-based parser for **bold** and *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Push text before the match
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    if (match[2]) {
      // Bold: **text**
      parts.push(<strong key={key++} className="text-green-400 font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      // Italic: *text*
      parts.push(<em key={key++} className="text-blue-400 not-italic font-medium">{match[3]}</em>);
    }
    lastIndex = regex.lastIndex;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
}

/* ═══════════════════════════════════════════════════════════
   REASONING TEXT — Safe **bold** parser (replaces dangerouslySetInnerHTML)
   ═══════════════════════════════════════════════════════════ */
function ReasoningText({ text }: { text: string }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return <>{parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="text-emerald-400">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>)}</>;
}

/* ═══════════════════════════════════════════════════════════
   CARD WRAPPER
   ═══════════════════════════════════════════════════════════ */
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  }),
};

function Card({
  children,
  className = '',
  style = {},
  delay = 0,
  variant = 'default',
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
  variant?: 'default' | 'jarvis';
}) {
  const isJarvis = variant === 'jarvis';
  return (
    <motion.div
      custom={delay}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      className={`${isJarvis ? 'jarvis-card' : 'rounded-[14px] border border-[rgba(255,255,255,0.06)]'} p-6 transition-all duration-200 hover:border-[rgba(255,255,255,0.12)] hover:-translate-y-px ${className}`}
      style={isJarvis ? { ...style } : { backgroundColor: '#0C0C12', ...style }}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MINI SPARKLINE
   ═══════════════════════════════════════════════════════════ */
function Sparkline({ data, color = '#2FFF6B', width = 120, height = 36 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data || data.length === 0) return <div style={{ width, height }} />;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive
            animationDuration={1200}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   1. ANIMATED ALEX AVATAR — Pure CSS Robot Face
   ═══════════════════════════════════════════════════════════ */
function AlexAvatar({ mood = 'neutral', status = 'idle', size = 48 }: {
  mood?: string;
  status?: 'trading' | 'analyzing' | 'stressed' | 'idle';
  size?: number;
}) {
  const moodClass = `alex-mood-${mood}`;
  const mouthClass = `alex-mouth-${mood}`;

  const statusColor = {
    trading: '#2FFF6B',
    analyzing: '#FFAA00',
    stressed: '#FF4444',
    idle: 'rgba(255,255,255,0.35)',
  }[status];

  const scale = size / 60;

  return (
    <div
      className="alex-character"
      style={{ width: size + 16, height: size + 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Glow ring */}
      <div
        className="alex-glow"
        style={{
          position: 'absolute',
          inset: -4,
          borderRadius: '50%',
          animation: 'alex-glow-pulse 3s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 0,
          transform: `scale(${scale})`,
        }}
      />
      {/* Head */}
      <div
        className={`alex-head ${moodClass}`}
        style={{
          width: size,
          height: size,
          animation: mood === 'fearful'
            ? 'alex-shake 0.5s ease-in-out infinite'
            : 'alex-breathe 3s ease-in-out infinite',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Eyes */}
        <div className="alex-eyes" style={{ display: 'flex', gap: size * 0.13 }}>
          <div className="alex-eye" style={{ animation: 'alex-blink 4s ease-in-out infinite' }}>
            <div className="alex-pupil" />
          </div>
          <div className="alex-eye" style={{ animation: 'alex-blink 4s ease-in-out infinite', animationDelay: '0.1s' }}>
            <div className="alex-pupil" />
          </div>
        </div>
        {/* Mouth */}
        <div className={`alex-mouth ${mouthClass}`} />
      </div>
      {/* Status dot */}
      <span
        style={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: statusColor,
          border: '2px solid #0C0C12',
          zIndex: 2,
          boxShadow: status === 'trading' ? '0 0 6px rgba(47,255,107,0.6)' : status === 'stressed' ? '0 0 6px rgba(255,68,68,0.6)' : 'none',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   2. STATUS BAR (top)
   ═══════════════════════════════════════════════════════════ */
function StatusBar() {
  const { isTradingEnabled, setTradingEnabled, marketStudyComplete } = useTradingStore();
  const live = useLiveTrading();

  // Derive mood from live stats
  const winRate = live.stats.winRate > 0 ? live.stats.winRate : agentState.winRate;
  const mood: string = winRate > 65 ? 'confident' : winRate > 50 ? 'focused' : winRate > 35 ? 'neutral' : 'cautious';

  const status: 'trading' | 'analyzing' | 'idle' = isTradingEnabled
    ? marketStudyComplete ? 'trading' : 'analyzing'
    : 'idle';

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-wrap items-center justify-between gap-4 mb-5 px-1"
    >
      {/* Left: Avatar + Name */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <AlexAvatar mood={mood} status={status} size={48} />
          <div className={`alex-jarvis-ring alex-mood-${mood}`} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-inter text-lg font-semibold text-white">{agentState.name || 'Alex'}</span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wider"
              style={{ backgroundColor: 'rgba(47,163,255,0.12)', color: '#2FA3FF', border: '1px solid rgba(47,163,255,0.2)' }}
            >
              FUTURES
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                backgroundColor: isTradingEnabled ? '#2FFF6B' : '#FF4444',
                boxShadow: isTradingEnabled ? '0 0 6px rgba(47,255,107,0.5)' : '0 0 6px rgba(255,68,68,0.3)',
              }}
            />
            <span className="font-inter text-[11px] text-text-muted">
              {isTradingEnabled ? 'Trading Active' : 'Trading Paused'}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Live indicator */}
      <div className="hidden md:flex items-center gap-5">
        <div className="flex items-center gap-1.5">
          <Radio size={13} className="text-profit animate-pulse" />
          <span className="font-inter text-xs font-medium text-profit tracking-wide">LIVE PRICES</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CircleDot size={13} className="text-accent-blue" />
          <span className="font-inter text-xs text-text-secondary">
            Cycle #{useTradingStore.getState().trades.length + 1}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap size={13} className="text-warning" />
          <span className="font-inter text-xs text-text-secondary">
            {live.marketData.length} markets
          </span>
        </div>
      </div>

      {/* Right: Trading toggle */}
      <motion.button
        className="flex items-center gap-2 px-4 py-2 rounded-full font-inter text-xs font-semibold transition-all duration-200"
        style={{
          backgroundColor: isTradingEnabled ? 'rgba(47, 255, 107, 0.10)' : 'rgba(255, 68, 68, 0.10)',
          color: isTradingEnabled ? '#2FFF6B' : '#FF4444',
          border: `1px solid ${isTradingEnabled ? 'rgba(47,255,107,0.2)' : 'rgba(255,68,68,0.2)'}`,
        }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setTradingEnabled(!isTradingEnabled)}
      >
        <Power size={14} />
        {isTradingEnabled ? 'TRADING ON' : 'TRADING OFF'}
      </motion.button>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   2b. ALEX SPEECH BUBBLE — Latest reasoning + typing indicator
   ═══════════════════════════════════════════════════════════ */
function AlexSpeechBubble() {
  const live = useLiveTrading();

  if (live.reasoning.length === 0) {
    return (
      <div className="mb-5 ml-14">
        <div className="alex-speech-bubble">
          <div className="alex-typing">
            <span className="text-[11px] text-gray-500 mr-2">Alex is analyzing markets</span>
            <span className="alex-typing-dot" /><span className="alex-typing-dot" /><span className="alex-typing-dot" />
          </div>
        </div>
      </div>
    );
  }

  const latest = live.reasoning[0];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 ml-14"
    >
      <div className="alex-speech-bubble">
        <p className="alex-message-human text-xs"><ReasoningText text={latest.text} /></p>
        <span className="text-[10px] text-gray-600 mt-1 block font-mono">{latest.timestamp}</span>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   3. INFO CARD — PORTFOLIO
   ═══════════════════════════════════════════════════════════ */
function PortfolioCard() {
  const live = useLiveTrading();
  const { positions, winCount, lossCount, totalPnl } = useTradingStore();
  const balance = useCountUp(portfolio.totalBalance, 1200, 200);
  const pnlVal = useCountUp(totalPnl + live.stats.totalPnl, 1000, 400);
  const allPositions = [...portfolio.positions, ...live.activePositions].slice(0, 5);

  return (
    <Card delay={0} variant="jarvis" className="col-span-12 md:col-span-1">
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-profit" />
          <h3 className="font-inter text-lg font-semibold text-white">Portfolio</h3>
        </div>
        <span
          className="text-[10px] font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: '#13131F', color: 'rgba(255,255,255,0.40)' }}
        >
          Testnet
        </span>
      </div>

      <p className="font-jetbrains text-3xl font-bold text-white tracking-tight">
        ${formatMoney(balance)}
      </p>
      <p className="font-inter text-[11px] text-text-muted mt-0.5">
        Starting: ${formatMoney(portfolio.startingBalance)}
      </p>

      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]">
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.04em] uppercase text-text-muted">Positions</p>
          <p className="font-jetbrains text-xl font-medium text-white mt-0.5">{allPositions.length + positions.length}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.04em] uppercase text-text-muted">W / L</p>
          <p className="font-jetbrains text-xl font-medium text-white mt-0.5">{winCount + live.stats.wins} / {lossCount + live.stats.losses}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold tracking-[0.04em] uppercase text-text-muted">Streak</p>
          <p className="font-jetbrains text-xl font-medium text-profit mt-0.5">+{live.stats.wins}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
        <span className="text-[10px] font-semibold tracking-[0.04em] uppercase text-text-muted">Total P&L</span>
        <span className="font-jetbrains text-lg font-bold text-profit">+${pnlVal.toFixed(2)}</span>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   4. INFO CARD — AGENT STATE
   ═══════════════════════════════════════════════════════════ */
function AgentStateCard() {
  const live = useLiveTrading();
  const { isTradingEnabled } = useTradingStore();

  const winRate = live.stats.winRate > 0 ? live.stats.winRate : agentState.winRate;
  const mood: string = winRate > 65 ? 'confident' : winRate > 50 ? 'focused' : winRate > 35 ? 'neutral' : 'cautious';
  const stressLevel = Math.max(0, Math.min(1, 1 - winRate / 100));
  const dominantStrategyLabel = live.stats.dominantStrategy.replace(/_/g, ' ');

  return (
    <Card delay={1} variant="jarvis" className="col-span-12 md:col-span-1">
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-accent-blue" />
          <h3 className="font-inter text-lg font-semibold text-white">Agent State</h3>
        </div>
        <span className="text-lg" title={mood}>{MOOD_EMOJI[mood] || '⚡'}</span>
      </div>

      {/* Mood */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-inter text-sm text-text-secondary">Mood:</span>
        <span className="font-inter text-sm font-semibold" style={{ color: '#FFCC44' }}>
          {MOOD_LABEL[mood] || 'Analyzing'}
        </span>
      </div>

      {/* Stress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold tracking-[0.04em] uppercase text-text-muted">Stress Level</span>
          <span className="font-jetbrains text-[10px] text-text-secondary">{Math.round(stressLevel * 100)}%</span>
        </div>
        <div className="w-full h-2 rounded-full bg-[#13131F] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${stressLevel * 100}%` }}
            transition={{ duration: 1, delay: 0.5 }}
            style={{
              backgroundColor: stressLevel > 0.7 ? '#FF4444' : stressLevel > 0.4 ? '#FFAA00' : '#2FFF6B',
            }}
          />
        </div>
      </div>

      {/* Strategy & Leverage */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1"
          style={{ backgroundColor: 'rgba(47,255,107,0.10)', color: '#2FFF6B' }}
        >
          <Target size={11} />
          {dominantStrategyLabel}
        </span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-[rgba(255,255,255,0.06)]">
        <span className="text-[10px] font-semibold tracking-[0.04em] uppercase text-text-muted">Max Leverage</span>
        <span className="font-jetbrains text-sm font-medium text-white">{agentState.maxLeverage || 10}x</span>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] font-semibold tracking-[0.04em] uppercase text-text-muted">Trading</span>
        <span className={`font-jetbrains text-[11px] font-medium ${isTradingEnabled ? 'text-profit' : 'text-loss'}`}>
          {isTradingEnabled ? 'ENABLED' : 'DISABLED'}
        </span>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   5. INFO CARD — MARKET SNAPSHOT
   ═══════════════════════════════════════════════════════════ */
function MarketSnapshotCard() {
  const live = useLiveTrading();
  const topCoins = live.marketData.slice(0, 4);

  const trendArrow = (direction?: string) => {
    if (direction === 'uptrend') return <TrendingUp size={13} className="text-profit" />;
    if (direction === 'downtrend') return <TrendingDown size={13} className="text-loss" />;
    return <Minus size={13} className="text-text-muted" />;
  };

  const trendColor = (direction?: string) => {
    if (direction === 'uptrend') return '#2FFF6B';
    if (direction === 'downtrend') return '#FF4444';
    return 'rgba(255,255,255,0.35)';
  };

  return (
    <Card delay={2} variant="jarvis" className="col-span-12 md:col-span-1">
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-warning" />
          <h3 className="font-inter text-lg font-semibold text-white">Market Snapshot</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
          <span className="font-inter text-[10px] font-medium text-profit">LIVE</span>
        </div>
      </div>

      <div className="space-y-3">
        {topCoins.map((coin, idx) => (
          <div key={coin.symbol}>
            {idx > 0 && <div className="border-t border-[rgba(255,255,255,0.06)] my-2.5" />}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-inter text-sm font-semibold text-white">{coin.symbol.replace('USDT', '')}</span>
                {trendArrow(coin.trend?.toLowerCase())}
              </div>
              <div className="text-right">
                <span className="font-jetbrains text-sm font-bold text-white">${formatMoney(coin.price)}</span>
                <span className={`font-inter text-[10px] ml-2 ${coin.change24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(2)}%
                </span>
              </div>
            </div>
            {/* S/R levels if available */}
            {coin.srLevels && (
              <div className="flex items-center gap-3 mt-1">
                <span className="font-inter text-[10px] text-text-muted">
                  S: <span className="text-profit">${formatMoney(coin.srLevels.support)}</span>
                </span>
                <span className="font-inter text-[10px] text-text-muted">
                  R: <span className="text-loss">${formatMoney(coin.srLevels.resistance)}</span>
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   6. OPEN POSITIONS TABLE (with lock overlay)
   ═══════════════════════════════════════════════════════════ */
function OpenPositionsTable() {
  const marketStudyComplete = useTradingStore(s => s.marketStudyComplete);
  const positions = useTradingStore(s => s.positions);
  const live = useLiveTrading();
  const allPositions = [...portfolio.positions, ...live.activePositions, ...positions];

  return (
    <Card delay={3} variant="jarvis" className="col-span-12 !p-0 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-accent-blue" />
          <h3 className="font-inter text-lg font-semibold text-white">Open Positions</h3>
          <span className="font-jetbrains text-xs text-text-muted">({allPositions.length})</span>
          <span className="text-[9px] text-blue-400 ml-2">BOS + CHoCH + Trend</span>
        </div>
      </div>

      {/* Lock Overlay */}
      <AnimatePresence>
        {!marketStudyComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center"
            style={{ backgroundColor: 'rgba(12,12,18,0.85)', backdropFilter: 'blur(4px)' }}
          >
            <Lock size={32} className="text-text-muted mb-2" />
            <p className="font-inter text-sm font-semibold text-text-secondary">Complete market study to unlock trading</p>
            <p className="font-inter text-xs text-text-muted mt-1">Run market analysis to enable position management</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="overflow-x-auto px-6 pb-5">
        {allPositions.length === 0 ? (
          <p className="font-inter text-sm text-text-muted text-center py-8">No open positions</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#13131F' }}>
                {['Symbol', 'Side', 'Entry', 'Size', 'P&L', 'Strategy'].map((h) => (
                  <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold tracking-[0.04em] uppercase text-text-muted whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allPositions.slice(0, 8).map((pos: Position, idx: number) => (
                <motion.tr
                  key={pos.symbol + (pos.strategy?.name || '') + idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.05, duration: 0.3 }}
                  className="border-b border-[rgba(255,255,255,0.04)] transition-colors duration-150 hover:bg-[#13131F]"
                >
                  <td className="px-3 py-2.5 font-inter text-xs font-medium text-white whitespace-nowrap">{pos.symbol}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: pos.side === 'BUY' ? 'rgba(47,255,107,0.12)' : 'rgba(255,68,68,0.12)',
                        color: pos.side === 'BUY' ? '#2FFF6B' : '#FF4444',
                      }}
                    >
                      {pos.side}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-jetbrains text-xs text-text-secondary whitespace-nowrap">${formatMoney(pos.entryPrice)}</td>
                  <td className="px-3 py-2.5 font-jetbrains text-xs text-text-secondary whitespace-nowrap">{pos.amount}</td>
                  <td className={`px-3 py-2.5 font-jetbrains text-xs font-medium whitespace-nowrap ${pos.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {pos.strategy && (
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: (STRATEGY_COLORS[pos.strategy.name] || '#2FA3FF') + '18',
                          color: STRATEGY_COLORS[pos.strategy.name] || '#2FA3FF',
                        }}
                      >
                        {pos.strategy.name.replace(/_/g, ' ')}
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   7. P&L CHART
   ═══════════════════════════════════════════════════════════ */
function PnlChartCard() {
  const [timeframe, setTimeframe] = useState<'1D' | '7D' | '30D'>('7D');

  const baseData = useMemo(() => {
    switch (timeframe) {
      case '1D': return pnlHistory1D;
      case '30D': return pnlHistory30D;
      default: return pnlHistory;
    }
  }, [timeframe]);

  const data = useMemo(() => {
    return baseData.map((d) => ({
      ...d,
      trend_following: Math.round(d.pnl * 0.4),
      mean_reversion: Math.round(d.pnl * 0.25),
      breakout: Math.round(d.pnl * 0.2),
      vwap_scalp: Math.round(d.pnl * 0.15),
    }));
  }, [baseData]);

  const bestDay = useMemo(() => {
    let maxIdx = 0;
    data.forEach((d, i) => { if (d.pnl > data[maxIdx].pnl) maxIdx = i; });
    return data[maxIdx];
  }, [data]);

  const worstDay = useMemo(() => {
    let minIdx = 0;
    data.forEach((d, i) => { if (d.pnl < data[minIdx].pnl) minIdx = i; });
    return data[minIdx];
  }, [data]);

  return (
    <Card delay={4} variant="jarvis" className="col-span-12 lg:col-span-6">
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-profit" />
          <h3 className="font-inter text-lg font-semibold text-white">P&L Over Time</h3>
        </div>
        <div className="flex items-center gap-1">
          {(['1D', '7D', '30D'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className="px-3 py-1 rounded-full font-inter text-xs font-medium transition-all duration-200"
              style={{
                backgroundColor: timeframe === tf ? 'rgba(47, 255, 107, 0.15)' : '#13131F',
                color: timeframe === tf ? '#2FFF6B' : 'rgba(255,255,255,0.65)',
                border: timeframe === tf ? '1px solid rgba(47, 255, 107, 0.25)' : '1px solid transparent',
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(47, 255, 107, 0.15)" />
                <stop offset="100%" stopColor="rgba(47, 255, 107, 0.02)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="0" horizontal vertical={false} stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="date"
              tick={{ fontFamily: 'JetBrains Mono', fontSize: 12, fill: 'rgba(255,255,255,0.40)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontFamily: 'JetBrains Mono', fontSize: 12, fill: 'rgba(255,255,255,0.40)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1A1A2E',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '10px',
                padding: '10px 14px',
              }}
              labelStyle={{ fontFamily: 'Inter', fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}
              itemStyle={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#2FFF6B' }}
              formatter={(value: number) => [`P&L: +$${value.toFixed(2)}`, '']}
            />
            <Area
              type="monotone"
              dataKey="pnl"
              stroke="#2FFF6B"
              strokeWidth={2}
              fill="url(#pnlGradient)"
              dot={{ r: 4, fill: '#2FFF6B', stroke: '#0C0C12', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#2FFF6B', stroke: '#0C0C12', strokeWidth: 2 }}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-3 mt-2 mb-1">
        <span className="text-[10px] font-semibold uppercase text-text-muted">Strategy Mix:</span>
        {Object.entries(STRATEGY_COLORS).map(([name, color]) => (
          <span key={name} className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[10px] text-text-secondary">{name.replace(/_/g, ' ')}</span>
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="font-inter text-xs text-profit">
          Best: {bestDay.date} +${bestDay.pnl.toFixed(2)}
        </span>
        <span className="font-inter text-xs text-text-muted">
          Worst: {worstDay.date} {worstDay.pnl < 0 ? '' : '+'}${worstDay.pnl.toFixed(2)}
        </span>
        <span className="font-inter text-xs text-profit">Trend: &uarr; Positive</span>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   8. REASONING LOG
   ═══════════════════════════════════════════════════════════ */
function ReasoningLogCard() {
  const live = useLiveTrading();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, []);

  const entries = live.reasoning.length > 0 ? live.reasoning : [];

  return (
    <Card delay={5} variant="jarvis" className="col-span-12 lg:col-span-6 !p-0 overflow-hidden" style={{ maxHeight: 360 }}>
      <div className="flex items-center justify-between px-6 pt-5 pb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-accent-blue" />
          <h3 className="font-inter text-lg font-semibold text-white">Alex Thoughts</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-profit animate-pulse" />
          <span className="font-inter text-[10px] font-medium text-profit">LIVE</span>
        </div>
      </div>

      <div ref={scrollRef} className="px-6 pb-5 overflow-y-auto relative z-10" style={{ maxHeight: 290 }}>
        <div className="space-y-4">
          {entries.map((entry, idx) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + idx * 0.08, duration: 0.35 }}
              className="flex gap-3 group"
            >
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className="w-6 h-6 rounded-full"
                  style={{
                    background: 'radial-gradient(circle at 40% 35%, rgba(47, 255, 107, 0.25) 0%, transparent 60%)',
                    backgroundColor: '#0C0C12',
                    boxShadow: '0 0 8px rgba(47, 255, 107, 0.1)',
                  }}
                />
                {idx < entries.length - 1 && (
                  <div className="w-px flex-1 mt-1 bg-[rgba(255,255,255,0.06)]" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-inter text-xs text-text-muted transition-colors group-hover:text-text-secondary">
                    {entry.timestamp}
                  </p>
                  {entry.strategy && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: (STRATEGY_COLORS[entry.strategy] || '#2FA3FF') + '18',
                        color: STRATEGY_COLORS[entry.strategy] || '#2FA3FF',
                      }}
                    >
                      {entry.strategy.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p className="alex-message-human text-sm italic leading-relaxed">
                  <ReasoningText text={entry.text} />
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {entries.length === 0 && (
          <div className="alex-speech-bubble mt-2">
            <div className="alex-typing">
              <span className="text-[11px] text-gray-500 mr-2">Alex is analyzing markets</span>
              <span className="alex-typing-dot" /><span className="alex-typing-dot" /><span className="alex-typing-dot" />
            </div>
          </div>
        )}

        {entries.length > 0 && (
          <div className="flex items-center gap-2 mt-4">
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-text-muted"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
            <span className="font-inter text-xs text-text-muted">Alex is analyzing...</span>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   9. RECENT TRADES — Clean Card (last 5 trades)
   ═══════════════════════════════════════════════════════════ */
function RecentTradesCard() {
  const { trades } = useTradingStore();
  const live = useLiveTrading();

  // Combine store trades + live trades, take last 5
  const allTrades = useMemo(() => {
    const storeTrades = trades.map((t) => ({
      id: t.id,
      time: formatTime(t.timestamp),
      symbol: t.symbol,
      side: t.side,
      price: t.exitPrice || t.entryPrice,
      pnl: t.pnl,
      strategy: t.strategy,
    }));
    const liveTrades = live.trades.slice(0, 8).map((t: Trade) => ({
      id: t.id,
      time: t.time,
      symbol: t.symbol,
      side: t.side,
      price: t.exitPrice,
      pnl: t.pnl,
      strategy: t.strategy,
    }));
    return [...storeTrades, ...liveTrades].slice(0, 5);
  }, [trades, live.trades]);

  return (
    <Card delay={6} className="col-span-12 lg:col-span-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-warning" />
          <h3 className="font-inter text-lg font-semibold text-white">Recent Trades</h3>
        </div>
        <span className="font-inter text-[11px] text-text-muted">Last 5</span>
      </div>

      {allTrades.length === 0 ? (
        <p className="font-inter text-sm text-text-muted text-center py-6">No trades yet</p>
      ) : (
        <div className="space-y-2.5">
          {allTrades.map((trade, idx) => (
            <motion.div
              key={trade.id + idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + idx * 0.08, duration: 0.3 }}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors duration-150 hover:bg-[#13131F]"
            >
              <div className="flex items-center gap-3">
                <span className="font-jetbrains text-[11px] text-text-muted w-10">{trade.time}</span>
                <span className="font-inter text-sm font-semibold text-white">{trade.symbol}</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: trade.side === 'BUY' || trade.side === 'LONG' ? 'rgba(47,255,107,0.12)' : 'rgba(255,68,68,0.12)',
                    color: trade.side === 'BUY' || trade.side === 'LONG' ? '#2FFF6B' : '#FF4444',
                  }}
                >
                  {trade.side}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-jetbrains text-xs text-text-secondary">${formatMoney(trade.price)}</span>
                <span className={`font-jetbrains text-xs font-medium ${trade.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   10. ALL 20 COINS GRID with trend badges
   ═══════════════════════════════════════════════════════════ */
function CoinsGrid() {
  const live = useLiveTrading();

  const trendBadge = (coin: (typeof live.marketData)[0]) => {
    const dir = coin.trend?.toLowerCase();
    if (dir === 'uptrend') return { text: '↗ UP', color: '#2FFF6B', bg: 'rgba(47,255,107,0.10)' };
    if (dir === 'downtrend') return { text: '↘ DOWN', color: '#FF4444', bg: 'rgba(255,68,68,0.10)' };
    return { text: '→ SIDE', color: 'rgba(255,255,255,0.40)', bg: 'rgba(255,255,255,0.06)' };
  };

  return (
    <Card delay={7} className="col-span-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-warning" />
          <h3 className="font-inter text-lg font-semibold text-white">All Markets</h3>
          <span className="font-jetbrains text-xs text-text-muted">({COINS.length})</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {live.marketData.map((coin, idx) => {
          const badge = trendBadge(coin);
          return (
            <motion.div
              key={coin.symbol}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + idx * 0.03, duration: 0.25 }}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-[rgba(255,255,255,0.04)] transition-all duration-150 hover:border-[rgba(255,255,255,0.10)] hover:bg-[#13131F]"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-inter text-xs font-semibold text-white">{coin.symbol.replace('USDT', '')}</span>
                  <span
                    className="text-[9px] font-bold px-1 py-0.5 rounded"
                    style={{ backgroundColor: badge.bg, color: badge.color }}
                  >
                    {badge.text}
                  </span>
                </div>
                <span className="font-jetbrains text-[11px] text-text-secondary">${formatMoney(coin.price)}</span>
              </div>
              <span className={`font-jetbrains text-[10px] font-medium ${coin.change24h >= 0 ? 'text-profit' : 'text-loss'}`}>
                {coin.change24h >= 0 ? '+' : ''}{coin.change24h.toFixed(1)}%
              </span>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   11. KILL SWITCH CARD
   ═══════════════════════════════════════════════════════════ */
function KillSwitchCard() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [halted, setHalted] = useState(false);
  const { setTradingEnabled } = useTradingStore();

  const handleConfirm = () => {
    setHalted(true);
    setShowConfirm(false);
    setTradingEnabled(false);
  };

  return (
    <Card
      delay={8}
      className={`col-span-12 transition-all duration-300 ${halted ? 'animate-border-pulse' : ''}`}
      style={{
        borderColor: halted ? 'rgba(255, 68, 68, 0.5)' : 'rgba(255, 68, 68, 0.15)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-loss" />
          <h3 className="font-inter text-lg font-semibold text-white">Emergency Control</h3>
        </div>
        <OctagonAlert size={20} className="text-loss" />
      </div>

      <div className="mt-2">
        <p className={`font-inter text-base font-semibold ${halted ? 'text-loss' : 'text-profit'}`}>
          {halted ? '\uD83D\uDD34 TRADING HALTED' : '\uD83D\uDFE2 Trading Active'}
        </p>
        <p className="font-inter text-sm text-text-secondary mt-0.5">
          {halted
            ? 'All trading operations have been stopped.'
            : 'Alex is executing strategies on Binance Testnet'}
        </p>
      </div>

      <motion.button
        className="w-full mt-4 py-3 px-8 rounded-[10px] font-inter text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200"
        style={{
          backgroundColor: halted ? '#1A1A2E' : '#FF4444',
          boxShadow: halted ? 'none' : '0 0 20px rgba(255, 68, 68, 0.15)',
        }}
        whileHover={!halted ? { scale: 1.02, boxShadow: '0 0 30px rgba(255, 68, 68, 0.3)' } : {}}
        whileTap={!halted ? { scale: 0.97 } : {}}
        onClick={() => halted ? (setHalted(false), setTradingEnabled(true)) : setShowConfirm(true)}
      >
        <OctagonAlert size={20} />
        {halted ? 'Resume Trading' : 'KILL SWITCH — STOP ALL TRADING'}
      </motion.button>

      <AnimatePresence>
        {showConfirm && !halted && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <p className="font-inter text-sm text-text-secondary text-center mb-3">
                Are you sure? This will immediately cancel all open orders.
              </p>
              <div className="flex gap-3">
                <button
                  className="flex-1 py-2.5 rounded-[10px] font-inter text-sm font-semibold text-white transition-all duration-200 hover:brightness-110"
                  style={{ backgroundColor: '#FF4444' }}
                  onClick={handleConfirm}
                >
                  Confirm
                </button>
                <button
                  className="flex-1 py-2.5 rounded-[10px] font-inter text-sm font-medium transition-all duration-200 hover:bg-[#1A1A2E]"
                  style={{ backgroundColor: '#13131F', color: 'rgba(255,255,255,0.65)' }}
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showConfirm && !halted && (
        <p className="font-inter text-xs text-text-muted mt-3 text-center">
          This will immediately cancel all open orders and halt Alex. Use in emergencies.
        </p>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD PAGE
   ═══════════════════════════════════════════════════════════ */
export default function Dashboard() {
  return (
    <div className="p-4 lg:p-6">
      {/* Status Bar */}
      <StatusBar />

      {/* Alex Speech Bubble — shows latest reasoning */}
      <AlexSpeechBubble />

      {/* 3 Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <PortfolioCard />
        <AgentStateCard />
        <MarketSnapshotCard />
      </div>

      {/* Open Positions */}
      <div className="mb-4">
        <OpenPositionsTable />
      </div>

      {/* P&L Chart + Reasoning Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <PnlChartCard />
        <ReasoningLogCard />
      </div>

      {/* Recent Trades + Kill Switch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <RecentTradesCard />
        <KillSwitchCard />
      </div>

      {/* All 20 Coins */}
      <CoinsGrid />
    </div>
  );
}
