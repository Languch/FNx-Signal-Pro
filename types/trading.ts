export type SignalDirection = 'CALL' | 'PUT' | 'WAIT';
export type SignalStatus = 'pre_alert' | 'active' | 'win' | 'loss' | 'mtg_win' | 'refund' | 'avoided';
export type MarketMode = 'all' | 'real' | 'otc';
export type DataSourceMode = 'websocket' | 'selenium';
export type VoiceLanguage = 'bn' | 'en';

export interface SignalEvent {
  id: string;
  assetId: string;
  assetName: string;
  marketType: 'real' | 'otc';
  direction: 'CALL' | 'PUT';
  timeframe: '1M' | '5M';
  durationSeconds: number;
  confidence: number;
  strategy: string;
  reason: string;
  entryPrice: number;
  closePrice?: number;
  createdTime: number;
  entryTime: number;
  expireTime: number;
  status: SignalStatus;
  payout: number;
  martingaleStep: number;
  marketRegime?: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'BREAKOUT';
  confluenceFactors?: string[];
  safetyMarginTip?: string;
  isAntiLossProtected?: boolean;
}

export interface SignalStats {
  totalSignals: number;
  wins: number;
  losses: number;
  mtgWins: number;
  accuracy: number;
  consecutiveLosses: number;
  antiLossCircuitStatus: 'ACTIVE' | 'STANDBY';
}

export interface ScannerAsset {
  id: string;
  name: string;
  marketType: 'real' | 'otc';
  category: 'forex' | 'forex_otc';
  basePrice: number;
  decimals: number;
  payout: number;
  currentPrice: number;
  rsi: number;
  stochK?: number;
  trend: 'BULLISH' | 'BEARISH' | 'RANGING';
  signalReadiness: 'READY' | 'SCANNING' | 'NEUTRAL';
}

export interface QuotexSession {
  isConnected: boolean;
  sourceMode: DataSourceMode;
  wsUrl: string;
  accountType: 'demo' | 'real';
  ssid: string;
  maskedToken: string;
  balance: number;
  latencyMs: number;
  wsStatus?: string;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  sendPreAlerts: boolean;
  sendResults: boolean;
}

export interface PureAnalysisResult {
  direction: SignalDirection;
  confidence: number;
  strategy: string;
  reason: string;
  regime: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'BREAKOUT';
  confluenceFactors: string[];
  rsi: number;
  stochK: number;
}