import { PureAnalysisResult } from '../types/trading';

export interface OHLC {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  ticks: number;
}

export function calculateEMA(values: number[], period: number): number {
  if (values.length === 0) return 0;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

export function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < 5) return 50;
  const p = Math.min(period, closes.length - 1);
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - p; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / p;
  const avgLoss = losses / p;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

export function calculateBollingerBands(closes: number[], period = 20, mult = 2) {
  if (closes.length < 10) return null;
  const p = Math.min(period, closes.length);
  const slice = closes.slice(-p);
  const sma = slice.reduce((a, b) => a + b, 0) / p;
  const variance = slice.reduce((a, b) => a + Math.pow(b - sma, 2), 0) / p;
  const sd = Math.sqrt(variance);
  return {
    upper: sma + sd * mult,
    middle: sma,
    lower: sma - sd * mult,
  };
}

export function calculateStochastic(candles: OHLC[], period = 14): number {
  if (candles.length < 5) return 50;
  const p = Math.min(period, candles.length);
  const slice = candles.slice(-p);
  const high = Math.max(...slice.map((c) => c.high));
  const low = Math.min(...slice.map((c) => c.low));
  const close = slice[slice.length - 1].close;
  if (high === low) return 50;
  return Number((((close - low) / (high - low)) * 100).toFixed(1));
}

export function calculateMACD(closes: number[]) {
  if (closes.length < 12) return { macd: 0, signal: 0, histogram: 0 };
  const macdSeries: number[] = [];
  const start = Math.min(12, closes.length - 1);
  for (let i = start; i <= closes.length; i++) {
    const sub = closes.slice(0, i);
    macdSeries.push(calculateEMA(sub, 6) - calculateEMA(sub, 12));
  }
  const currentMacd = macdSeries[macdSeries.length - 1];
  const signalLine = calculateEMA(macdSeries, 5);
  return {
    macd: currentMacd,
    signal: signalLine,
    histogram: currentMacd - signalLine,
  };
}

/**
 * Pure Institutional Multi-Confluence Analyzer (Zero Math.random)
 */
export function evaluatePureConfluence(closedCandles: OHLC[], assetName = 'Asset'): PureAnalysisResult {
  if (closedCandles.length < 12) {
    return {
      direction: 'WAIT',
      confidence: 0,
      strategy: 'Warming Up Live Indicators',
      reason: `Collecting closed price candles (${closedCandles.length}/12)...`,
      regime: 'RANGING',
      confluenceFactors: [`Warmup: ${closedCandles.length}/12`],
      rsi: 50,
      stochK: 50,
    };
  }

  const closes = closedCandles.map((c) => c.close);
  const last = closedCandles[closedCandles.length - 1];
  const prev = closedCandles[closedCandles.length - 2];

  // Flat / Doji Filter
  const body = Math.abs(last.close - last.open);
  const range = last.high - last.low;
  if (range === 0 || body / range < 0.10) {
    return {
      direction: 'WAIT',
      confidence: 40,
      strategy: 'Doji Indecision Filter',
      reason: 'Market is flat or Doji. Waiting for clear momentum candle.',
      regime: 'RANGING',
      confluenceFactors: ['Anti-Doji Protection Active'],
      rsi: calculateRSI(closes, 14),
      stochK: calculateStochastic(closedCandles, 14),
    };
  }

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const rsi = calculateRSI(closes, 14);
  const stochK = calculateStochastic(closedCandles, 14);
  const bb = calculateBollingerBands(closes, 20, 2);
  const macd = calculateMACD(closes);

  const upperWick = last.high - Math.max(last.open, last.close);
  const lowerWick = Math.min(last.open, last.close) - last.low;

  let callScore = 0;
  let putScore = 0;
  const callFactors: string[] = [];
  const putFactors: string[] = [];

  // 1. EMA Trend Flow
  if (ema9 > ema21 && last.close > ema9) {
    callScore += 20;
    callFactors.push('EMA(9>21) Bullish Trend');
  } else if (ema9 < ema21 && last.close < ema9) {
    putScore += 20;
    putFactors.push('EMA(9<21) Bearish Trend');
  }

  // 2. RSI Extremes & Momentum
  if (rsi <= 34) {
    callScore += 25;
    callFactors.push(`RSI(${rsi}) Oversold Reversal`);
  } else if (rsi >= 66) {
    putScore += 25;
    putFactors.push(`RSI(${rsi}) Overbought Reversal`);
  } else if (rsi > 52 && ema9 > ema21) {
    callScore += 15;
    callFactors.push(`RSI(${rsi}) Bullish Flow`);
  } else if (rsi < 48 && ema9 < ema21) {
    putScore += 15;
    putFactors.push(`RSI(${rsi}) Bearish Flow`);
  }

  // 3. Bollinger Bands
  if (bb) {
    if (last.low <= bb.lower && last.close > last.open) {
      callScore += 25;
      callFactors.push('Lower BB Rejection');
    } else if (last.high >= bb.upper && last.close < last.open) {
      putScore += 25;
      putFactors.push('Upper BB Rejection');
    }
  }

  // 4. Stochastic
  if (stochK <= 25) {
    callScore += 15;
    callFactors.push(`Stochastic(${stochK}) Oversold`);
  } else if (stochK >= 75) {
    putScore += 15;
    putFactors.push(`Stochastic(${stochK}) Overbought`);
  }

  // 5. MACD Momentum
  if (macd.histogram > 0 && macd.macd > macd.signal) {
    callScore += 15;
    callFactors.push('MACD Bullish Cross');
  } else if (macd.histogram < 0 && macd.macd < macd.signal) {
    putScore += 15;
    putFactors.push('MACD Bearish Cross');
  }

  // 6. Candlestick Price Action
  const isBullEngulfing = last.close > last.open && prev.close < prev.open && last.close > prev.open;
  const isBearEngulfing = last.close < last.open && prev.close > prev.open && last.close < prev.open;
  const isHammer = lowerWick > body * 1.5 && upperWick < body * 0.6;
  const isShootingStar = upperWick > body * 1.5 && lowerWick < body * 0.6;

  if (isBullEngulfing || isHammer) {
    callScore += 20;
    callFactors.push(isBullEngulfing ? 'Bullish Engulfing' : 'Hammer Pin-Bar');
  }
  if (isBearEngulfing || isShootingStar) {
    putScore += 20;
    putFactors.push(isBearEngulfing ? 'Bearish Engulfing' : 'Shooting Star');
  }

  // Pure Signal Gate (>= 55 score & at least 2 strong confluences)
  if (callScore >= 55 && callScore > putScore + 15 && callFactors.length >= 2) {
    return {
      direction: 'CALL',
      confidence: Math.min(97, Math.max(84, callScore + 20)),
      strategy: callFactors.slice(0, 2).join(' + '),
      reason: `${callFactors.length} pure indicators confirmed CALL on ${assetName}.`,
      regime: ema9 > ema21 ? 'TRENDING_UP' : 'RANGING',
      confluenceFactors: callFactors,
      rsi,
      stochK,
    };
  }

  if (putScore >= 55 && putScore > callScore + 15 && putFactors.length >= 2) {
    return {
      direction: 'PUT',
      confidence: Math.min(97, Math.max(84, putScore + 20)),
      strategy: putFactors.slice(0, 2).join(' + '),
      reason: `${putFactors.length} pure indicators confirmed PUT on ${assetName}.`,
      regime: ema9 < ema21 ? 'TRENDING_DOWN' : 'RANGING',
      confluenceFactors: putFactors,
      rsi,
      stochK,
    };
  }

  return {
    direction: 'WAIT',
    confidence: Math.max(callScore, putScore),
    strategy: 'Scanning Pure Confluence',
    reason: `RSI(${rsi}) · Stoch(${stochK}) · Waiting for clean multi-indicator alignment.`,
    regime: 'RANGING',
    confluenceFactors: [...callFactors, ...putFactors].slice(0, 3),
    rsi,
    stochK,
  };
}

export function buildCandlesFromTicks(ticks: { price: number; time: number }[], candleSeconds = 15): OHLC[] {
  if (ticks.length === 0) return [];
  const ms = candleSeconds * 1000;
  const map = new Map<number, OHLC>();

  for (const t of ticks) {
    const bucket = Math.floor(t.time / ms) * ms;
    const existing = map.get(bucket);
    if (!existing) {
      map.set(bucket, { time: bucket, open: t.price, high: t.price, low: t.price, close: t.price, ticks: 1 });
    } else {
      existing.high = Math.max(existing.high, t.price);
      existing.low = Math.min(existing.low, t.price);
      existing.close = t.price;
      existing.ticks += 1;
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => a.time - b.time);
  return sorted.length > 1 ? sorted.slice(0, -1) : sorted;
}