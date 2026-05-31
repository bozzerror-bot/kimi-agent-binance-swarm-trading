export interface StrategyInfo {
  name: string;
  confidence: number;
  regime: string;
}

export interface Position {
  symbol: string;
  amount: number;
  value: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  sparkline: number[];
  side: 'LONG' | 'SHORT';
  strategy?: StrategyInfo;
  timeframe?: string;
}

export interface PnLDataPoint {
  date: string;
  pnl: number;
  strategyBreakdown?: Record<string, number>;
}

export interface Trade {
  id: string;
  time: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number;
  size: number;
  pnl: number;
  status: 'FILLED' | 'PARTIAL';
  timestamp: string;
  strategy?: StrategyInfo;
  regime?: string;
}

export interface ReasoningEntry {
  id: string;
  timestamp: string;
  text: string;
  strategy?: string;
  regime?: string;
}

export interface SRLevels {
  support: number;
  resistance: number;
}

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  rsi: number;
  macd: 'Bullish' | 'Bearish' | 'Neutral';
  trend: 'Uptrend' | 'Downtrend' | 'Sideways';
  sparkline: number[];
  regime?: string;
  srLevels?: SRLevels;
  volume24h?: number;
}

export interface PersonalityConfig {
  riskTolerance: number;
  confidence: number;
  patience: number;
  adaptability: number;
}

export interface AgentState {
  name: string;
  mood: string;
  emoji: string;
  stress: number;
  streak: number;
  winRate: number;
  totalPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  status: string;
  personality: PersonalityConfig;
  activeStrategy?: string;
  marketRegime?: string;
  bestCoin?: string;
}

export interface Portfolio {
  totalBalance: number;
  startingBalance: number;
  usdtAvailable: number;
  positions: Position[];
  dailyPnl: number;
  dailyPnlPercent: number;
}

export const agentState: AgentState = {
  name: 'Alex',
  mood: 'cautious-optimistic',
  emoji: '🤔',
  stress: 0.2,
  streak: 2,
  winRate: 67,
  totalPnl: 50,
  totalTrades: 3,
  wins: 2,
  losses: 1,
  status: 'Online — Trading',
  personality: {
    riskTolerance: 0.72,
    confidence: 0.65,
    patience: 0.80,
    adaptability: 0.60,
  },
  activeStrategy: 'trend_following',
  marketRegime: 'trending',
  bestCoin: 'BTCUSDT',
};

export const portfolio: Portfolio = {
  totalBalance: 12450,
  startingBalance: 12400,
  usdtAvailable: 8750,
  dailyPnl: 12.30,
  dailyPnlPercent: 0.10,
  positions: [
    {
      symbol: 'BTC',
      amount: 0.05,
      value: 2150,
      entryPrice: 43000,
      currentPrice: 43000,
      pnl: 28.40,
      sparkline: [42800, 42950, 43100, 43000, 43200, 43150, 43000],
      side: 'LONG',
      strategy: { name: 'trend_following', confidence: 0.78, regime: 'trending' },
    },
    {
      symbol: 'ETH',
      amount: 0.5,
      value: 1550,
      entryPrice: 2800,
      currentPrice: 2800,
      pnl: 18.20,
      sparkline: [2780, 2795, 2810, 2805, 2820, 2810, 2800],
      side: 'LONG',
      strategy: { name: 'mean_reversion', confidence: 0.65, regime: 'ranging' },
    },
    {
      symbol: 'SOL',
      amount: 2.0,
      value: 290,
      entryPrice: 145,
      currentPrice: 145,
      pnl: 5.80,
      sparkline: [142, 143, 144, 145, 146, 145, 145],
      side: 'LONG',
      strategy: { name: 'breakout', confidence: 0.72, regime: 'volatile' },
    },
    {
      symbol: 'BNB',
      amount: 0.3,
      value: 178.5,
      entryPrice: 595,
      currentPrice: 595,
      pnl: 2.10,
      sparkline: [590, 592, 594, 595, 596, 595, 595],
      side: 'LONG',
      strategy: { name: 'vwap_scalp', confidence: 0.60, regime: 'mixed' },
    },
    {
      symbol: 'LINK',
      amount: 3.0,
      value: 51,
      entryPrice: 17,
      currentPrice: 17,
      pnl: 1.20,
      sparkline: [16.5, 16.7, 16.9, 17, 17.1, 17, 17],
      side: 'LONG',
      strategy: { name: 'mean_reversion', confidence: 0.70, regime: 'ranging' },
    },
  ],
};

export const pnlHistory: PnLDataPoint[] = [
  { date: 'Mon', pnl: 5 },
  { date: 'Tue', pnl: 12 },
  { date: 'Wed', pnl: 8 },
  { date: 'Thu', pnl: 22 },
  { date: 'Fri', pnl: 35 },
  { date: 'Sat', pnl: 42 },
  { date: 'Sun', pnl: 50 },
];

export const pnlHistory1D: PnLDataPoint[] = [
  { date: '00:00', pnl: 0 },
  { date: '04:00', pnl: 3 },
  { date: '08:00', pnl: 7 },
  { date: '12:00', pnl: 10 },
  { date: '16:00', pnl: 14 },
  { date: '20:00', pnl: 11 },
  { date: '23:59', pnl: 12 },
];

export const pnlHistory30D: PnLDataPoint[] = [
  { date: 'May 1', pnl: -5 },
  { date: 'May 3', pnl: 2 },
  { date: 'May 5', pnl: -3 },
  { date: 'May 7', pnl: 8 },
  { date: 'May 9', pnl: 12 },
  { date: 'May 11', pnl: 15 },
  { date: 'May 13', pnl: 10 },
  { date: 'May 15', pnl: 22 },
  { date: 'May 17', pnl: 18 },
  { date: 'May 19', pnl: 25 },
  { date: 'May 21', pnl: 30 },
  { date: 'May 23', pnl: 28 },
  { date: 'May 25', pnl: 35 },
  { date: 'May 27', pnl: 42 },
  { date: 'May 29', pnl: 38 },
  { date: 'May 31', pnl: 50 },
];

export const recentTrades: Trade[] = [
  {
    id: '1',
    time: '14:20',
    symbol: 'BTCUSDT',
    side: 'BUY',
    entryPrice: 67180.00,
    exitPrice: 67320.00,
    size: 0.02,
    pnl: 2.80,
    status: 'FILLED',
    timestamp: '2024-05-31T14:20:00Z',
    strategy: { name: 'trend_following', confidence: 0.82, regime: 'trending' },
    regime: 'trending',
  },
  {
    id: '2',
    time: '13:45',
    symbol: 'ETHUSDT',
    side: 'BUY',
    entryPrice: 3450.20,
    exitPrice: 3498.00,
    size: 0.04,
    pnl: 1.92,
    status: 'FILLED',
    timestamp: '2024-05-31T13:45:00Z',
    strategy: { name: 'mean_reversion', confidence: 0.74, regime: 'ranging' },
    regime: 'ranging',
  },
  {
    id: '3',
    time: '12:10',
    symbol: 'BTCUSDT',
    side: 'SELL',
    entryPrice: 67500.00,
    exitPrice: 67380.00,
    size: 0.01,
    pnl: 1.20,
    status: 'FILLED',
    timestamp: '2024-05-31T12:10:00Z',
    strategy: { name: 'vwap_scalp', confidence: 0.68, regime: 'mixed' },
    regime: 'mixed',
  },
  {
    id: '4',
    time: '10:30',
    symbol: 'ETHUSDT',
    side: 'SELL',
    entryPrice: 3520.00,
    exitPrice: 3490.00,
    size: 0.03,
    pnl: -0.90,
    status: 'FILLED',
    timestamp: '2024-05-31T10:30:00Z',
    strategy: { name: 'breakout', confidence: 0.55, regime: 'volatile' },
    regime: 'volatile',
  },
  {
    id: '5',
    time: '09:15',
    symbol: 'BTCUSDT',
    side: 'BUY',
    entryPrice: 66950.00,
    exitPrice: 67100.00,
    size: 0.02,
    pnl: 3.00,
    status: 'FILLED',
    timestamp: '2024-05-31T09:15:00Z',
    strategy: { name: 'trend_following', confidence: 0.79, regime: 'trending' },
    regime: 'trending',
  },
  {
    id: '6',
    time: '08:40',
    symbol: 'SOLUSDT',
    side: 'BUY',
    entryPrice: 142.50,
    exitPrice: 146.20,
    size: 1.5,
    pnl: 5.55,
    status: 'FILLED',
    timestamp: '2024-05-31T08:40:00Z',
    strategy: { name: 'breakout', confidence: 0.76, regime: 'volatile' },
    regime: 'volatile',
  },
  {
    id: '7',
    time: '07:55',
    symbol: 'BNBUSDT',
    side: 'SELL',
    entryPrice: 602.00,
    exitPrice: 598.50,
    size: 0.5,
    pnl: 1.75,
    status: 'FILLED',
    timestamp: '2024-05-31T07:55:00Z',
    strategy: { name: 'vwap_scalp', confidence: 0.63, regime: 'mixed' },
    regime: 'mixed',
  },
  {
    id: '8',
    time: '06:20',
    symbol: 'LINKUSDT',
    side: 'BUY',
    entryPrice: 16.80,
    exitPrice: 17.15,
    size: 4.0,
    pnl: 1.40,
    status: 'FILLED',
    timestamp: '2024-05-31T06:20:00Z',
    strategy: { name: 'mean_reversion', confidence: 0.71, regime: 'ranging' },
    regime: 'ranging',
  },
];

export const marketData: MarketData[] = [
  {
    symbol: 'BTC/USDT',
    name: 'BTC',
    price: 43250,
    change24h: 2.4,
    rsi: 68,
    macd: 'Bullish',
    trend: 'Uptrend',
    sparkline: [42000, 42200, 41800, 42500, 42800, 43200, 43000, 43100, 42900, 43000, 43200, 43150, 43000, 43100, 43200, 43100, 43300, 43200, 43150, 43250, 43200, 43100, 43250, 43300, 43250, 43100, 43200, 43250, 43200, 43250],
    regime: 'trending',
    srLevels: { support: 42500, resistance: 44000 },
    volume24h: 28500000000,
  },
  {
    symbol: 'ETH/USDT',
    name: 'ETH',
    price: 2780,
    change24h: 1.8,
    rsi: 52,
    macd: 'Neutral',
    trend: 'Sideways',
    sparkline: [2750, 2780, 2760, 2790, 2820, 2810, 2800, 2795, 2810, 2805, 2820, 2810, 2800, 2790, 2800, 2810, 2800, 2795, 2800, 2785, 2795, 2800, 2785, 2775, 2780, 2775, 2780, 2785, 2780, 2780],
    regime: 'ranging',
    srLevels: { support: 2720, resistance: 2850 },
    volume24h: 12500000000,
  },
  {
    symbol: 'SOL/USDT',
    name: 'SOL',
    price: 145,
    change24h: 3.2,
    rsi: 61,
    macd: 'Bullish',
    trend: 'Uptrend',
    sparkline: [138, 140, 139, 141, 143, 142, 144, 143, 144, 145, 146, 145, 144, 145, 146, 145, 144, 145, 146, 145, 144, 145, 146, 145, 144, 145, 145, 145, 145, 145],
    regime: 'trending',
    srLevels: { support: 138, resistance: 152 },
    volume24h: 3200000000,
  },
  {
    symbol: 'BNB/USDT',
    name: 'BNB',
    price: 595,
    change24h: 0.8,
    rsi: 48,
    macd: 'Neutral',
    trend: 'Sideways',
    sparkline: [590, 592, 591, 593, 594, 593, 594, 595, 596, 595, 594, 595, 596, 595, 594, 595, 596, 595, 594, 595, 596, 595, 594, 595, 596, 595, 594, 595, 595, 595],
    regime: 'mixed',
    srLevels: { support: 585, resistance: 610 },
    volume24h: 1800000000,
  },
];

export const reasoningLog: ReasoningEntry[] = [
  {
    id: '1',
    timestamp: '14:32:05',
    text: '[trend_following] BTC showing strength on the 15m. RSI at 62 — not overbought yet. MACD crossed bullish 2 candles ago. I\'m watching for a pullback entry.',
    strategy: 'trend_following',
    regime: 'trending',
  },
  {
    id: '2',
    timestamp: '14:28:12',
    text: '[mean_reversion] ETH pulled back to the 20 EMA in this ranging market. Good risk/reward here for a long. My patience setting says wait for confirmation though.',
    strategy: 'mean_reversion',
    regime: 'ranging',
  },
  {
    id: '3',
    timestamp: '14:15:33',
    text: '[trend_following] Closed the BTC long at $67,320. Hit my target. +$2.80. Not greedy — my confidence meter says take profits here.',
    strategy: 'trend_following',
    regime: 'trending',
  },
  {
    id: '4',
    timestamp: '13:50:00',
    text: '[breakout] BTC volume surging on the breakout above $43.5k resistance. My adaptability is high today so I\'m riding this momentum.',
    strategy: 'breakout',
    regime: 'volatile',
  },
  {
    id: '5',
    timestamp: '13:45:18',
    text: '[mean_reversion] Entered ETH long at $3,450.20. Clean support bounce in the range. Risk tolerance says 2% max — position sized accordingly.',
    strategy: 'mean_reversion',
    regime: 'ranging',
  },
  {
    id: '6',
    timestamp: '13:30:22',
    text: '[vwap_scalp] Scalping BNB around the VWAP. Mixed regime so keeping positions small and tight stops.',
    strategy: 'vwap_scalp',
    regime: 'mixed',
  },
  {
    id: '7',
    timestamp: '13:15:10',
    text: '[breakout] SOL breaking out of the consolidation range with volume. Entered long at $142.50 — targeting $146+.',
    strategy: 'breakout',
    regime: 'volatile',
  },
  {
    id: '8',
    timestamp: '12:45:33',
    text: '[vwap_scalp] Quick scalp on LINK around VWAP. Mean reversion in this ranging market — took profits at $17.15.',
    strategy: 'vwap_scalp',
    regime: 'mixed',
  },
];
