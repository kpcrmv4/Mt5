export interface Price {
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  time: string;
}

export interface AccountInfo {
  balance: number;
  equity: number;
  profit: number;
  margin: number;
  freeMargin: number;
}

export interface Performance {
  balance: number;
  equity: number;
  profit: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  openPositions: number;
  updatedAt: string;
}

export interface GridLevel {
  price: number;
  type: 'buy' | 'sell';
  hasOrder: boolean;
}

export interface GridStatus {
  running: boolean;
  regime: string;
  newsShieldActive: boolean;
  grid: {
    buyLevels: number[];
    sellLevels: number[];
    midPrice: number;
    spacing: number;
    indicators: Indicators;
  } | null;
}

export interface Indicators {
  rsi: number;
  atr: number;
  atrRatio: number;
  emaFast: number;
  emaSlow: number;
  emaCross: 'bullish' | 'bearish';
  price: number;
  timestamp: string;
}

export interface Position {
  id: string;
  type: string;
  symbol: string;
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  openTime: string;
  comment: string;
}

export interface Order {
  id: string;
  type: string;
  symbol: string;
  volume: number;
  openPrice: number;
  tp: number;
  sl: number;
  comment: string;
}

export interface AiAnalysis {
  regime: string;
  confidence: number;
  trend: string;
  reasoning: string;
  riskLevel: string;
  timestamp: string;
}

export interface NewsShieldStatus {
  enabled: boolean;
  shieldActive: boolean;
  currentImpact: string;
  lastCheck: string;
  upcomingEvents: { event: string; expected_time: string; impact: string }[];
}

export interface TradingConfig {
  grid: Record<string, number>;
  filters: Record<string, boolean | number>;
  ai: Record<string, boolean | number>;
  newsShield: Record<string, boolean | number>;
  risk: Record<string, number>;
}

export interface RealtimeUpdate {
  price: Price;
  positions: Position[];
  orders: Order[];
  account: AccountInfo;
  grid: GridStatus;
  newsShield: NewsShieldStatus;
  aiRegime: AiAnalysis;
  timestamp: string;
}
