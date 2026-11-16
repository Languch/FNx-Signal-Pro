import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import { evaluatePureConfluence, OHLC } from './src/utils/signalEngine';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

export interface AssetInfo {
  id: string;
  name: string;
  marketType: 'real' | 'otc';
  category: 'forex' | 'forex_otc';
  basePrice: number;
  decimals: number;
  payout: number;
  currentPrice: number;
}

// 25 Real Pairs + 12 OTC Pairs (Zero Math.random simulation!)
const ASSETS: Record<string, AssetInfo> = {
  // Real Pairs
  'EURUSD': { id: 'EURUSD', name: 'EUR/USD', marketType: 'real', category: 'forex', basePrice: 1.0852, decimals: 5, payout: 87, currentPrice: 0 },
  'GBPUSD': { id: 'GBPUSD', name: 'GBP/USD', marketType: 'real', category: 'forex', basePrice: 1.2945, decimals: 5, payout: 85, currentPrice: 0 },
  'USDJPY': { id: 'USDJPY', name: 'USD/JPY', marketType: 'real', category: 'forex', basePrice: 153.25, decimals: 3, payout: 86, currentPrice: 0 },
  'AUDUSD': { id: 'AUDUSD', name: 'AUD/USD', marketType: 'real', category: 'forex', basePrice: 0.6582, decimals: 5, payout: 84, currentPrice: 0 },
  'USDCAD': { id: 'USDCAD', name: 'USD/CAD', marketType: 'real', category: 'forex', basePrice: 1.3895, decimals: 5, payout: 85, currentPrice: 0 },
  'NZDUSD': { id: 'NZDUSD', name: 'NZD/USD', marketType: 'real', category: 'forex', basePrice: 0.5975, decimals: 5, payout: 83, currentPrice: 0 },
  'USDCHF': { id: 'USDCHF', name: 'USD/CHF', marketType: 'real', category: 'forex', basePrice: 0.8654, decimals: 5, payout: 84, currentPrice: 0 },
  'EURGBP': { id: 'EURGBP', name: 'EUR/GBP', marketType: 'real', category: 'forex', basePrice: 0.8383, decimals: 5, payout: 83, currentPrice: 0 },
  'EURJPY': { id: 'EURJPY', name: 'EUR/JPY', marketType: 'real', category: 'forex', basePrice: 166.30, decimals: 3, payout: 85, currentPrice: 0 },
  'GBPJPY': { id: 'GBPJPY', name: 'GBP/JPY', marketType: 'real', category: 'forex', basePrice: 198.38, decimals: 3, payout: 86, currentPrice: 0 },
  'AUDJPY': { id: 'AUDJPY', name: 'AUD/JPY', marketType: 'real', category: 'forex', basePrice: 100.87, decimals: 3, payout: 84, currentPrice: 0 },
  'EURAUD': { id: 'EURAUD', name: 'EUR/AUD', marketType: 'real', category: 'forex', basePrice: 1.6487, decimals: 5, payout: 83, currentPrice: 0 },
  'CADJPY': { id: 'CADJPY', name: 'CAD/JPY', marketType: 'real', category: 'forex', basePrice: 110.29, decimals: 3, payout: 84, currentPrice: 0 },
  'EURCAD': { id: 'EURCAD', name: 'EUR/CAD', marketType: 'real', category: 'forex', basePrice: 1.5079, decimals: 5, payout: 84, currentPrice: 0 },
  'GBPAUD': { id: 'GBPAUD', name: 'GBP/AUD', marketType: 'real', category: 'forex', basePrice: 1.9667, decimals: 5, payout: 85, currentPrice: 0 },
  'EURCHF': { id: 'EURCHF', name: 'EUR/CHF', marketType: 'real', category: 'forex', basePrice: 0.9391, decimals: 5, payout: 82, currentPrice: 0 },
  'GBPCHF': { id: 'GBPCHF', name: 'GBP/CHF', marketType: 'real', category: 'forex', basePrice: 1.1203, decimals: 5, payout: 83, currentPrice: 0 },
  'CHFJPY': { id: 'CHFJPY', name: 'CHF/JPY', marketType: 'real', category: 'forex', basePrice: 177.08, decimals: 3, payout: 85, currentPrice: 0 },
  'AUDCAD': { id: 'AUDCAD', name: 'AUD/CAD', marketType: 'real', category: 'forex', basePrice: 0.9145, decimals: 5, payout: 84, currentPrice: 0 },
  'AUDNZD': { id: 'AUDNZD', name: 'AUD/NZD', marketType: 'real', category: 'forex', basePrice: 1.1016, decimals: 5, payout: 83, currentPrice: 0 },
  'NZDJPY': { id: 'NZDJPY', name: 'NZD/JPY', marketType: 'real', category: 'forex', basePrice: 91.56, decimals: 3, payout: 84, currentPrice: 0 },
  'CADCHF': { id: 'CADCHF', name: 'CAD/CHF', marketType: 'real', category: 'forex', basePrice: 0.6228, decimals: 5, payout: 82, currentPrice: 0 },
  'EURNZD': { id: 'EURNZD', name: 'EUR/NZD', marketType: 'real', category: 'forex', basePrice: 1.8162, decimals: 5, payout: 84, currentPrice: 0 },
  'GBPNZD': { id: 'GBPNZD', name: 'GBP/NZD', marketType: 'real', category: 'forex', basePrice: 2.1665, decimals: 5, payout: 85, currentPrice: 0 },
  'AUDCHF': { id: 'AUDCHF', name: 'AUD/CHF', marketType: 'real', category: 'forex', basePrice: 0.5696, decimals: 5, payout: 83, currentPrice: 0 },

  // Quotex OTC Pairs
  'EURUSD_otc': { id: 'EURUSD_otc', name: 'EUR/USD (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 5, payout: 90, currentPrice: 0 },
  'GBPUSD_otc': { id: 'GBPUSD_otc', name: 'GBP/USD (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 5, payout: 89, currentPrice: 0 },
  'USDJPY_otc': { id: 'USDJPY_otc', name: 'USD/JPY (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 3, payout: 88, currentPrice: 0 },
  'AUDCAD_otc': { id: 'AUDCAD_otc', name: 'AUD/CAD (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 5, payout: 87, currentPrice: 0 },
  'NZDUSD_otc': { id: 'NZDUSD_otc', name: 'NZD/USD (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 5, payout: 90, currentPrice: 0 },
  'USDCAD_otc': { id: 'USDCAD_otc', name: 'USD/CAD (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 5, payout: 88, currentPrice: 0 },
  'EURGBP_otc': { id: 'EURGBP_otc', name: 'EUR/GBP (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 5, payout: 86, currentPrice: 0 },
  'EURJPY_otc': { id: 'EURJPY_otc', name: 'EUR/JPY (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 3, payout: 88, currentPrice: 0 },
  'GBPJPY_otc': { id: 'GBPJPY_otc', name: 'GBP/JPY (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 3, payout: 89, currentPrice: 0 },
  'AUDUSD_otc': { id: 'AUDUSD_otc', name: 'AUD/USD (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 5, payout: 87, currentPrice: 0 },
  'USDCHF_otc': { id: 'USDCHF_otc', name: 'USD/CHF (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 5, payout: 86, currentPrice: 0 },
  'AUDJPY_otc': { id: 'AUDJPY_otc', name: 'AUD/JPY (OTC)', marketType: 'otc', category: 'forex_otc', basePrice: 0, decimals: 3, payout: 87, currentPrice: 0 },
};

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
  status: 'pre_alert' | 'active' | 'win' | 'loss' | 'mtg_win' | 'refund' | 'avoided';
  payout: number;
  martingaleStep: number;
  marketRegime?: 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'BREAKOUT';
  confluenceFactors?: string[];
  safetyMarginTip?: string;
}

// ============================================================================
// 💽 PERSISTENT DATABASES (Signals & 1-IP License Keys)
// ============================================================================
let signalFeed: SignalEvent[] = [];
let signalStats = {
  totalSignals: 0,
  wins: 0,
  losses: 0,
  mtgWins: 0,
  accuracy: 0,
  consecutiveLosses: 0,
  antiLossCircuitStatus: 'STANDBY' as 'ACTIVE' | 'STANDBY',
};

const DB_PATH = path.join(process.cwd(), 'signal_db.json');
function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      if (data.signalFeed) signalFeed = data.signalFeed;
      if (data.signalStats) signalStats = data.signalStats;
    }
  } catch {}
}
function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify({ signalFeed, signalStats }, null, 2), 'utf-8');
  } catch {}
}
loadDatabase();

interface LicenseItem {
  key: string;
  boundIp: string | null;
  activatedAt: number | null;
  status: 'active' | 'unclaimed';
}
const LICENSE_DB_PATH = path.join(process.cwd(), 'licenses_db.json');
let licenses: LicenseItem[] = [];
function initLicenseDatabase() {
  try {
    if (fs.existsSync(LICENSE_DB_PATH)) {
      licenses = JSON.parse(fs.readFileSync(LICENSE_DB_PATH, 'utf-8'));
    } else {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      licenses = Array.from({ length: 100 }, () => {
        const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        return { key: `FNX-${seg()}-${seg()}-${seg()}`, boundIp: null, activatedAt: null, status: 'unclaimed' };
      });
      fs.writeFileSync(LICENSE_DB_PATH, JSON.stringify(licenses, null, 2), 'utf-8');
      console.log(`[LICENSE] Generated 100 unique VIP keys in licenses_db.json`);
    }
  } catch {}
}
initLicenseDatabase();

// ============================================================================
// 🌐 DYNAMIC QUOTEX WEBSOCKET CLIENT (User provides URL per session)
// ============================================================================
let activeQuotexWs: WebSocket | null = null;
let pingTimer: NodeJS.Timeout | null = null;
let wsConnectionStatus = 'DISCONNECTED';

const realCandles: Record<string, OHLC[]> = {};
Object.keys(ASSETS).forEach((id) => {
  realCandles[id] = [];
});

function recordRealTick(assetId: string, price: number, payout?: number) {
  const asset = ASSETS[assetId];
  if (!asset || !price || isNaN(price)) return;

  asset.currentPrice = price;
  if (typeof payout === 'number' && payout > 0) {
    asset.payout = payout;
  }

  const now = Date.now();
  const minuteBucket = Math.floor(now / 10000) * 10000;
  const list = realCandles[assetId];
  const last = list[list.length - 1];

  if (!last || last.time < minuteBucket) {
    list.push({ time: minuteBucket, open: price, high: price, low: price, close: price, ticks: 1 });
    if (list.length > 100) list.shift();
  } else {
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    last.close = price;
    last.ticks += 1;
  }
}

function connectDynamicQuotexWs(wsUrl: string, ssid?: string, accountType: 'demo' | 'real' = 'demo') {
  if (activeQuotexWs) {
    activeQuotexWs.removeAllListeners();
    activeQuotexWs.close();
    activeQuotexWs = null;
  }
  if (pingTimer) clearInterval(pingTimer);

  wsConnectionStatus = 'CONNECTING';
  console.log(`[WS] Connecting to Dynamic Quotex URL: ${wsUrl}`);

  const ws = new WebSocket(wsUrl, {
    headers: {
      Origin: 'https://market-qx.info',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
  });

  activeQuotexWs = ws;

  ws.on('open', () => {
    wsConnectionStatus = 'CONNECTED';
    console.log('[WS] Quotex WebSocket connected!');
  });

  ws.on('message', (raw: WebSocket.Data) => {
    const msg = raw.toString();

    // Engine.IO Open Packet: 0{"sid":...,"pingInterval":25000}
    if (msg.startsWith('0')) {
      try {
        const meta = JSON.parse(msg.substring(1));
        const intervalMs = meta.pingInterval || 25000;
        if (pingTimer) clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('2');
        }, intervalMs);
      } catch {}

      ws.send('40');
      if (ssid && ssid.length > 5) {
        ws.send(`42["authorization",{"session":"${ssid}","isDemo":${accountType === 'demo' ? 1 : 0},"tournamentId":0}]`);
      }
      // Subscribe to OTC & Real quotes
      Object.keys(ASSETS).forEach((id) => {
        ws.send(`42["instruments/update",{"asset":"${id}","period":60}]`);
        ws.send(`42["sub_candles",{"asset":"${id}","period":60}]`);
      });
      return;
    }

    // Heartbeat Ping -> Reply Pong
    if (msg === '2') {
      ws.send('3');
      return;
    }

    // Parse Socket.IO Event Data
    if (msg.startsWith('42')) {
      try {
        const parsed = JSON.parse(msg.substring(2));
        if (Array.isArray(parsed) && parsed.length >= 2) {
          const eventName = parsed[0];
          const payload = parsed[1];

          // Match Quotex real-time price & payout stream packets
          if (payload && typeof payload === 'object') {
            const assetKey = payload.asset || payload.pair || payload.symbol;
            const priceVal = parseFloat(payload.price || payload.close || payload.value || payload.quote);
            const payoutVal = payload.profit ? Number(payload.profit) : undefined;
            if (assetKey && ASSETS[assetKey] && !isNaN(priceVal)) {
              recordRealTick(assetKey, priceVal, payoutVal);
            }
          }
          if (eventName === 'quotes/stream' && Array.isArray(payload)) {
            payload.forEach((item: any) => {
              if (item && item[0] && ASSETS[item[0]] && !isNaN(parseFloat(item[1]))) {
                recordRealTick(item[0], parseFloat(item[1]));
              }
            });
          }
        }
      } catch {}
    }
  });

  ws.on('error', (err) => {
    wsConnectionStatus = 'ERROR';
    console.warn('[WS] Error:', err.message);
  });

  ws.on('close', () => {
    wsConnectionStatus = 'DISCONNECTED';
    if (pingTimer) clearInterval(pingTimer);
    console.log('[WS] Quotex WebSocket closed.');
  });
}

// ============================================================================
// 🔍 REAL FOREX API BACKUP SYNC (For Real Market Pairs when WS not active)
// ============================================================================
async function syncRealForexRates() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      if (data?.result === 'success' && data.rates) {
        const r = data.rates;
        const updates: Record<string, number> = {
          EURUSD: 1 / r.EUR,
          GBPUSD: 1 / r.GBP,
          USDJPY: r.JPY,
          AUDUSD: 1 / r.AUD,
          USDCAD: r.CAD,
          NZDUSD: 1 / r.NZD,
          USDCHF: r.CHF,
          EURGBP: r.GBP / r.EUR,
          EURJPY: r.JPY / r.EUR,
          GBPJPY: r.JPY / r.GBP,
          AUDJPY: r.JPY / r.AUD,
          EURAUD: r.AUD / r.EUR,
          CADJPY: r.JPY / r.CAD,
          EURCAD: r.CAD / r.EUR,
          GBPAUD: r.AUD / r.GBP,
          EURCHF: r.CHF / r.EUR,
          GBPCHF: r.CHF / r.GBP,
          CHFJPY: r.JPY / r.CHF,
          AUDCAD: r.CAD / r.AUD,
          AUDNZD: r.NZD / r.AUD,
          NZDJPY: r.JPY / r.NZD,
          CADCHF: r.CHF / r.CAD,
          EURNZD: r.NZD / r.EUR,
          GBPNZD: r.NZD / r.GBP,
          AUDCHF: r.CHF / r.AUD,
        };
        Object.entries(updates).forEach(([id, val]) => {
          if (ASSETS[id] && wsConnectionStatus !== 'CONNECTED') {
            recordRealTick(id, Number(val.toFixed(ASSETS[id].decimals)));
          }
        });
      }
    }
  } catch {}
}
// syncRealForexRates();
// setInterval(syncRealForexRates, 15000);

// ============================================================================
// ⚙️ SCANNER STATE & TELEGRAM CONFIG
// ============================================================================
let minPayoutThreshold = 80;
let selectedPairsFilter: string[] = [];
let activeSignal: SignalEvent | null = null;
let upcomingPreAlert: SignalEvent | null = null;
let lastTelegramSignalMinute = -1;
const pairCooldowns: Record<string, number> = {};

let telegramConfig = {
  enabled: false,
  botToken: '',
  chatId: '',
  sendPreAlerts: true,
  sendResults: true,
};

async function broadcastToTelegram(text: string) {
  if (!telegramConfig.enabled || !telegramConfig.botToken || !telegramConfig.chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramConfig.chatId, text, parse_mode: 'HTML' }),
    });
  } catch {}
}

// ============================================================================
// ⏱️ ANTI-REPAINTING PURE CONFLUENCE SCANNER LOOP (NO Math.random!)
// ============================================================================
setInterval(() => {
  const now = Date.now();
  const oneMinuteMs = 60 * 1000;
  const currentMinuteKey = Math.floor(now / oneMinuteMs);
  const currentMinuteStart = currentMinuteKey * oneMinuteMs;
  const secondsIntoMinute = Math.floor((now - currentMinuteStart) / 1000);

  // 1. Pre-Alert at Candle Close Confirmation (45s..55s)
  if (secondsIntoMinute >= 45 && secondsIntoMinute <= 55) {
    if (currentMinuteKey !== lastTelegramSignalMinute && !activeSignal && !upcomingPreAlert) {
      let pool = Object.values(ASSETS);
      if (selectedPairsFilter.length > 0) {
        pool = pool.filter((a) => selectedPairsFilter.includes(a.id));
      }

      const validPool = pool.filter(
        (a) => a.currentPrice > 0 && a.payout >= minPayoutThreshold && (!pairCooldowns[a.id] || now > pairCooldowns[a.id])
      );

      const candidates = validPool
        .map((asset) => {
          const candles = realCandles[asset.id] || [];
          // Strictly use CLOSED candles (all except current incomplete candle) for Anti-Repainting!
          const closed = candles.length > 1 ? candles.slice(0, -1) : [];
          return { asset, analysis: evaluatePureConfluence(closed, asset.name) };
        })
        .filter((item) => item.analysis.direction !== 'WAIT')
        .sort((a, b) => b.analysis.confidence - a.analysis.confidence);

      if (candidates.length > 0) {
        const best = candidates[0];
        const nextMinuteStart = currentMinuteStart + oneMinuteMs;

        upcomingPreAlert = {
          id: `sig_${now}_${best.asset.id}`,
          assetId: best.asset.id,
          assetName: best.asset.name,
          marketType: best.asset.marketType,
          direction: best.analysis.direction as 'CALL' | 'PUT',
          timeframe: '1M',
          durationSeconds: 60,
          confidence: best.analysis.confidence,
          strategy: best.analysis.strategy,
          reason: best.analysis.reason,
          entryPrice: best.asset.currentPrice,
          createdTime: now,
          entryTime: nextMinuteStart,
          expireTime: nextMinuteStart + 60000,
          status: 'pre_alert',
          payout: best.asset.payout,
          martingaleStep: 0,
          marketRegime: best.analysis.regime,
          confluenceFactors: best.analysis.confluenceFactors,
        };

        lastTelegramSignalMinute = currentMinuteKey;

        if (telegramConfig.sendPreAlerts) {
          const actionText = upcomingPreAlert.direction === 'CALL' ? '🟢 CALL / UP' : '🔴 PUT / DOWN';
          const msg = `🚀 <b>FNx SIGNAL PRO — VIP SIGNAL</b> 🚀\n\n` +
            `📊 Pair: <b>${best.asset.name}</b> (${best.asset.marketType.toUpperCase()})\n` +
            `🎯 Action: <b>${actionText}</b>\n` +
            `⏳ Expiry: <b>1 MINUTE (M1)</b>\n` +
            `⏰ Entry: <b>Next Candle Open</b>\n` +
            `💰 Payout: <b>${best.asset.payout}%</b>\n` +
            `🛡️ Confluence: <b>${best.analysis.confidence}% (${best.analysis.strategy})</b>`;
          broadcastToTelegram(msg);
        }
      }
    }
  }

  // 2. Candle Open Activation (00s..03s)
  if (secondsIntoMinute >= 0 && secondsIntoMinute <= 3 && upcomingPreAlert && !activeSignal) {
    const triggered = { ...upcomingPreAlert };
    triggered.status = 'active';
    triggered.entryPrice = ASSETS[triggered.assetId]?.currentPrice || triggered.entryPrice;
    triggered.entryTime = now;
    triggered.expireTime = now + 60000;
    activeSignal = triggered;
    upcomingPreAlert = null;
  }

  // 3. Candle Expiration (After 60s) -> Wait for Manual Broker Outcome
  if (activeSignal && now >= activeSignal.expireTime) {
    const asset = ASSETS[activeSignal.assetId];
    if (asset && asset.currentPrice > 0) {
      activeSignal.closePrice = asset.currentPrice;
    }
    signalFeed.unshift({ ...activeSignal });
    saveDatabase();
    activeSignal = null;
  }
}, 1000);

// ============================================================================
// 📡 API ENDPOINTS
// ============================================================================
app.post('/api/license/verify', (req: Request, res: Response) => {
  const { key } = req.body;
  if (!key || typeof key !== 'string') {
    res.status(400).json({ success: false, error: 'Please enter a valid License Key' });
    return;
  }
  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const clientIp = Array.isArray(rawIp) ? rawIp[0] : rawIp.split(',')[0].trim();

  const target = licenses.find((l) => l.key.toUpperCase() === key.trim().toUpperCase());
  if (!target) {
    res.status(401).json({ success: false, error: 'Invalid VIP License Key.' });
    return;
  }
  if (target.boundIp && target.boundIp !== clientIp) {
    res.status(403).json({ success: false, error: 'This License Key is already locked to another IP/Device!' });
    return;
  }
  if (!target.boundIp) {
    target.boundIp = clientIp;
    target.activatedAt = Date.now();
    target.status = 'active';
    fs.writeFileSync(LICENSE_DB_PATH, JSON.stringify(licenses, null, 2), 'utf-8');
  }
  res.json({ success: true, key: target.key, message: 'Access Granted!' });
});

let lastExtensionPing = 0;
let extensionActiveAsset = '';
let extensionActivePrice: number | undefined = undefined;

app.post('/api/bridge/push-price', (req: Request, res: Response) => {
  const { activeAsset, ticks } = req.body;
  lastExtensionPing = Date.now();
  wsConnectionStatus = 'CONNECTED';

  if (activeAsset) {
    extensionActiveAsset = activeAsset;
  }

  if (Array.isArray(ticks)) {
    ticks.forEach((t: any) => {
      if (t && t.asset && typeof t.price === 'number' && t.price > 0) {
       
        const cleanId = t.asset
          .replace(/\s*\(OTC\)/i, '_otc')
          .replace('/', '')
          .trim();

        if (!ASSETS[cleanId]) {
          const isOtc = cleanId.toLowerCase().includes('_otc');
          ASSETS[cleanId] = {
            id: cleanId,
            name: t.asset,
            marketType: isOtc ? 'otc' : 'real',
            category: isOtc ? 'forex_otc' : 'forex',
            basePrice: t.price,
            decimals: t.price > 50 ? 3 : 5,
            payout: t.payout || 88,
            currentPrice: t.price,
          };
          realCandles[cleanId] = [];
        }

        recordRealTick(cleanId, t.price, t.payout);

        // Track active chart price
        const cleanActive = (activeAsset || '').split('\n')[0].replace(/\d+%/g, '').trim();
        if (cleanActive) {
        extensionActiveAsset = cleanActive;
        }
      }
    });
  }

  res.json({ success: true });
});

app.get('/api/signals/live', (_req: Request, res: Response) => {
  const activeAsset = activeSignal ? ASSETS[activeSignal.assetId] : null;

  // ✅ 1. Chrome Extension 5-second alive check
  const isExtAlive = Date.now() - lastExtensionPing < 5000;
  const effectiveStatus = isExtAlive
    ? 'CONNECTED'
    : activeQuotexWs
      ? wsConnectionStatus
      : 'DISCONNECTED';

  // ✅ 2. Live Analysis / Warmup progress for active Quotex chart
  const normActiveId = (extensionActiveAsset || '')
    .replace(/\s*\(OTC\)/i, '_otc')
    .replace('/', '')
    .trim();
  const targetCandles = realCandles[normActiveId] || [];
  const closed = targetCandles.length > 1 ? targetCandles.slice(0, -1) : [];
  const liveAnalysis = normActiveId
    ? evaluatePureConfluence(closed, extensionActiveAsset)
    : null;

  res.json({
    success: true,
    wsConnectionStatus: effectiveStatus,
    liveAsset: extensionActiveAsset,        // ✅ মিসিং ছিল
    livePrice: extensionActivePrice,        // ✅ মিসিং ছিল
    pureAnalysis: liveAnalysis,             // ✅ লাইভ অ্যানালাইসিস স্ট্যাটাস
    minPayoutThreshold,
    selectedPairs: selectedPairsFilter,
    activeSignal,
    upcomingPreAlert,
    currentPrice: activeAsset?.currentPrice || extensionActivePrice || undefined,
    recentSignals: signalFeed,
    stats: signalStats,
    serverTime: Date.now(),
  });
});

app.post('/api/quotex/connect', (req: Request, res: Response) => {
  const { wsUrl, ssid, accountType = 'demo', sourceMode } = req.body;
  if (sourceMode === 'websocket') {
    if (!wsUrl || (!wsUrl.startsWith('wss://') && !wsUrl.startsWith('ws://'))) {
      res.status(400).json({ success: false, error: 'Valid wss:// URL required' });
      return;
    }
    connectDynamicQuotexWs(wsUrl, ssid, accountType);
    res.json({ success: true, message: `Connecting to Quotex WebSocket session...`, wsStatus: wsConnectionStatus });
  } else {
    if (activeQuotexWs) {
      activeQuotexWs.close();
      activeQuotexWs = null;
    }
    wsConnectionStatus = 'SELENIUM_MODE';
    res.json({ success: true, message: 'Switched to Python Selenium Local Bridge (Port 5000)' });
  }
});

app.post('/api/signals/pair-filter', (req: Request, res: Response) => {
  const { pairs } = req.body;
  if (Array.isArray(pairs)) {
    selectedPairsFilter = pairs;
    res.json({ success: true, selectedPairs: selectedPairsFilter });
  } else {
    res.status(400).json({ success: false, error: 'Invalid pairs array' });
  }
});

app.post('/api/signals/payout-settings', (req: Request, res: Response) => {
  const { minPayout } = req.body;
  if (typeof minPayout === 'number' && minPayout >= 60 && minPayout <= 95) {
    minPayoutThreshold = minPayout;
    res.json({ success: true, minPayoutThreshold });
  } else {
    res.status(400).json({ success: false, error: 'Invalid threshold' });
  }
});

// 🐍 Register Signal generated from Python Selenium Bridge (Save DB + Broadcast Telegram)
app.post('/api/signals/register-selenium', (req: Request, res: Response) => {
  const { signal } = req.body;
  if (!signal || !signal.id) {
    res.status(400).json({ success: false });
    return;
  }

  // Prevent duplicates
  if (!signalFeed.some((s) => s.id === signal.id)) {
    signalFeed.unshift(signal);
    saveDatabase();

    if (telegramConfig.sendPreAlerts) {
      const actionText = signal.direction === 'CALL' ? '🟢 CALL / UP' : '🔴 PUT / DOWN';
      const msg = `🚀 <b>FNx SIGNAL PRO — VIP SIGNAL</b> 🚀\n\n` +
        `📊 Pair: <b>${signal.assetName}</b> (${signal.marketType.toUpperCase()})\n` +
        `🎯 Action: <b>${actionText}</b>\n` +
        `⏳ Expiry: <b>1 MINUTE (M1)</b>\n` +
        `🛡️ Confluence: <b>${signal.confidence}% (${signal.strategy})</b>`;
      broadcastToTelegram(msg);
    }
  }
  res.json({ success: true });
});

app.post('/api/signals/clear-history', (_req: Request, res: Response) => {
  signalFeed.length = 0;
  signalStats = { totalSignals: 0, wins: 0, losses: 0, mtgWins: 0, accuracy: 0, consecutiveLosses: 0, antiLossCircuitStatus: 'STANDBY' };
  saveDatabase();
  res.json({ success: true });
});

app.post('/api/signals/submit-result', (req: Request, res: Response) => {
  const { signalId, outcome } = req.body;
  if (!signalId || !['win', 'loss', 'mtg_win', 'refund', 'avoided'].includes(outcome)) {
    res.status(400).json({ success: false, error: 'Invalid parameters' });
    return;
  }
  const sig = signalFeed.find((s) => s.id === signalId);
  if (sig) sig.status = outcome;

  const valid = signalFeed.filter((s) => ['win', 'loss', 'mtg_win'].includes(s.status));
  const wins = signalFeed.filter((s) => s.status === 'win').length;
  const mtg = signalFeed.filter((s) => s.status === 'mtg_win').length;
  const losses = signalFeed.filter((s) => s.status === 'loss').length;

  signalStats.totalSignals = signalFeed.filter((s) => s.status !== 'avoided').length;
  signalStats.wins = wins;
  signalStats.mtgWins = mtg;
  signalStats.losses = losses;
  signalStats.accuracy = valid.length > 0 ? Number((((wins + mtg) / valid.length) * 100).toFixed(1)) : 0;
  saveDatabase();

  if (telegramConfig.sendResults && sig) {
    const actionText = sig.direction === 'CALL' ? '🟢 CALL' : '🔴 PUT';
    let msg = '';
    if (outcome === 'avoided') {
      msg = `⚠️ <b>SIGNAL STATUS: AVOIDED</b>\n📊 Pair: <b>${sig.assetName}</b>\n🎯 Signal: <b>${actionText}</b>\n📈 Accuracy: <b>${signalStats.accuracy}%</b>`;
    } else {
      const label = outcome === 'win' ? '✅ DIRECT WIN' : outcome === 'mtg_win' ? '⚡ 1-STEP MTG WIN' : outcome === 'loss' ? '❌ LOSS' : '🔄 REFUND';
      msg = `🏁 <b>TRADE RESULT: ${label}</b>\n📊 Pair: <b>${sig.assetName}</b>\n🎯 Signal: <b>${actionText}</b>\n📈 Accuracy: <b>${signalStats.accuracy}%</b>`;
    }
    broadcastToTelegram(msg);
  }
  res.json({ success: true, signal: sig, stats: signalStats });
});

app.post('/api/signals/override-result', (req: Request, res: Response) => {
  const { signalId, status } = req.body;
  if (!signalId || !['win', 'loss', 'mtg_win', 'refund', 'avoided'].includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid parameters' });
    return;
  }
  const sig = signalFeed.find((s) => s.id === signalId);
  if (!sig) {
    res.status(404).json({ success: false, error: 'Signal not found' });
    return;
  }
  sig.status = status;

  const valid = signalFeed.filter((s) => ['win', 'loss', 'mtg_win'].includes(s.status));
  const wins = signalFeed.filter((s) => s.status === 'win').length;
  const mtg = signalFeed.filter((s) => s.status === 'mtg_win').length;
  const losses = signalFeed.filter((s) => s.status === 'loss').length;

  signalStats.totalSignals = signalFeed.filter((s) => s.status !== 'avoided').length;
  signalStats.wins = wins;
  signalStats.mtgWins = mtg;
  signalStats.losses = losses;
  signalStats.accuracy = valid.length > 0 ? Number((((wins + mtg) / valid.length) * 100).toFixed(1)) : 0;
  saveDatabase();
  res.json({ success: true, signal: sig, stats: signalStats });
});

app.get('/api/telegram/config', (_req: Request, res: Response) => res.json({ success: true, config: telegramConfig }));
app.post('/api/telegram/config', (req: Request, res: Response) => {
  telegramConfig = { ...telegramConfig, ...req.body };
  res.json({ success: true, config: telegramConfig });
});
app.post('/api/telegram/test', async (req: Request, res: Response) => {
  const token = req.body.botToken || telegramConfig.botToken;
  const chat = req.body.chatId || telegramConfig.chatId;
  if (!token || !chat) return res.status(400).json({ success: false, error: 'Token & Chat ID required' });
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: `⚡ <b>FNx Signal Pro</b> connected!`, parse_mode: 'HTML' }),
    });
    const j = await r.json();
    res.json(j.ok ? { success: true } : { success: false, error: j.description });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.all('/api/*', (_req: Request, res: Response) => res.status(404).json({ success: false, error: 'Route not found' }));

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req: Request, res: Response) => res.sendFile(path.resolve('dist/index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`FNx Signal Pro running on http://localhost:${PORT}`));
}
startServer();