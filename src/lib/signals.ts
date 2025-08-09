import axios from 'axios';
// Set axios defaults to keep provider fallbacks snappy
axios.defaults.timeout = 3500; // 3.5s per request to bound sequential provider retries
axios.defaults.maxRedirects = 0;

import { RSI, SMA, MACD, EMA, ATR } from 'technicalindicators';
// Removed unused direct imports; fetchCurrentPrice will import lazily below
import { fetchFundamentalData } from './fundamentals';

// Config: live price anchoring thresholds.
// If current price vs last close differs significantly by ratio, ATR multiple,
// or Forex pip distance, we re-anchor computed levels to the live price.
// Defaults target large discrepancies while remaining safe for Crypto.
// You can override via LIVE_PRICE_ANCHOR_* env vars (or NEXT_PUBLIC_* variants).
const LIVE_PRICE_ANCHOR_RATIO: number = (() => {
  const raw = process.env.LIVE_PRICE_ANCHOR_RATIO ?? process.env.NEXT_PUBLIC_LIVE_PRICE_ANCHOR_RATIO;
  const n = raw ? Number(raw) : 1.2;
  // Guardrails: require > 1.0 to make sense as a ratio, else fallback to default
  return Number.isFinite(n) && n > 1.0 ? n : 1.2;
})();

const LIVE_PRICE_ANCHOR_ATR_MULTIPLIER: number = (() => {
  const raw = process.env.LIVE_PRICE_ANCHOR_ATR_MULTIPLIER ?? process.env.NEXT_PUBLIC_LIVE_PRICE_ANCHOR_ATR_MULTIPLIER;
  const n = raw ? Number(raw) : 5; // default: 5x ATR
  return Number.isFinite(n) && n > 0 ? n : 5;
})();

const LIVE_PRICE_ANCHOR_FX_PIPS: number = (() => {
  const raw = process.env.LIVE_PRICE_ANCHOR_FX_PIPS ?? process.env.NEXT_PUBLIC_LIVE_PRICE_ANCHOR_FX_PIPS;
  const n = raw ? Number(raw) : 50; // default: 50 pips
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
})();

function isJpyPair(pair: string): boolean {
  return pair.toUpperCase().includes('JPY');
}

function getFxPipSize(pair: string): number {
  // Standard FX pip sizes: 0.0001 for most, 0.01 for JPY pairs
  return isJpyPair(pair) ? 0.01 : 0.0001;
}

function shouldReanchorLevels(params: {
  pair: string;
  isCrypto: boolean;
  lastClose: number;
  currentPrice: number;
  atr?: number;
  volatility?: number;
}): boolean {
  const { pair, isCrypto, lastClose, currentPrice, atr, volatility } = params;
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return false;
  const minP = Math.min(currentPrice, lastClose);
  const maxP = Math.max(currentPrice, lastClose);
  const ratio = maxP / Math.max(1e-8, minP);
  const absDiff = Math.abs(currentPrice - lastClose);
  const atrOrVol = atr ?? volatility ?? 0;
  const isFx = !isCrypto;
  const pipSize = isFx ? getFxPipSize(pair) : 0;
  const diffInPips = isFx && pipSize > 0 ? absDiff / pipSize : 0;

  const ratioFlag = ratio > LIVE_PRICE_ANCHOR_RATIO;
  const atrFlag = atrOrVol > 0 ? absDiff > LIVE_PRICE_ANCHOR_ATR_MULTIPLIER * atrOrVol : false;
  const pipsFlag = isFx ? diffInPips > LIVE_PRICE_ANCHOR_FX_PIPS : false;
  return ratioFlag || atrFlag || pipsFlag;
}

// Type aliases (code quality / reuse)
export type SignalType = 'Buy' | 'Sell' | 'Hold';
export type RiskCategory = 'Low' | 'Medium' | 'High';
type DirectionBias = 'bull' | 'bear' | 'neutral';
type AssetClass = 'Forex' | 'Crypto';

export interface FullSignalResult {
  pair: string;
  assetClass: AssetClass;
  type: SignalType;
  confidence: number;
  timeframe: string;
  buyLevel: number;
  stopLoss: number;
  takeProfit: number;
  explanation: string;
  stale?: boolean; // true when returned from soft-stale cache/fallback
  news: { title: string; url: string }[];
  indicators: { rsi: number; sma50: number; sma200: number; ema20?: number; ema50?: number; atr?: number; macd?: number; macdSignal?: number; macdHist?: number };
  fundamentals: { score: number; factors: string[] };
  riskReward?: number;
  riskCategory?: RiskCategory;
  volatilityPct?: number;
  compositeScore?: number; // blended technical + fundamental
  history?: number[]; // recent closes for charting
  technicalScore?: number; // 0-100 technical composite raw
  fundamentalScore?: number; // fundamentals raw
  explanationSections?: { title: string; details: string[] }[]; // structured explanation
}

const TIMEFRAME_CONFIG: Record<string, { macdFast: number; macdSlow: number; macdSignal: number }> = {
  '1m': { macdFast: 5, macdSlow: 13, macdSignal: 3 },
  '5m': { macdFast: 5, macdSlow: 13, macdSignal: 3 },
  '15m': { macdFast: 8, macdSlow: 17, macdSignal: 5 },
  '30m': { macdFast: 12, macdSlow: 26, macdSignal: 9 },
  '1H': { macdFast: 12, macdSlow: 26, macdSignal: 9 },
  '4H': { macdFast: 19, macdSlow: 39, macdSignal: 9 },
  '1D': { macdFast: 12, macdSlow: 26, macdSignal: 9 },
};

// Explicit crypto symbol set to avoid treating every USD pair as crypto
const CRYPTO_SYMBOLS = new Set([
  'BTC','ETH','SOL','XRP','ADA','DOGE','LTC','BNB','DOT','AVAX','LINK','MATIC','TRX','SHIB','BCH','XLM','NEAR','UNI'
]);
const isCrypto = (pair: string): boolean => {
  const base = pair.split('/')[0].toUpperCase();
  return CRYPTO_SYMBOLS.has(base);
};

const HISTORY_LOOKBACK: Record<string, number> = { '1m': 300, '5m': 300, '15m': 200, '30m': 180, '1H': 120, '4H': 90, '1D': 365 };

interface PriceSeries { closes: number[]; highs?: number[]; lows?: number[]; }

// Reintroduce simple in-memory cache and fallback generator
const memoryCache: Record<string, { ts: number; data: number[] }> = {};
function cacheKey(pair: string, tf: string) { return `${pair}:${tf}`; }
const generateFallbackData = (pair: string): number[] => {
  const base = pair.split('/')[0].toUpperCase();
  const isC = ['BTC','ETH','SOL','XRP','ADA','DOGE','LTC','BNB','DOT','AVAX','LINK'].includes(base);
  const basePrice = isC ? 50000 : 1.1;
  const variance = isC ? 1000 : 0.05;
  return Array.from({ length: 60 }, (_, i) => basePrice + Math.sin(i / 5) * variance * 0.01 + (Math.random() - 0.5) * variance * 0.002);
};

// Helper: fallback daily timeseries via exchangerate.host
async function fetchForexTimeseriesFallback(pair: string): Promise<PriceSeries> {
  const [fromSym, toSym] = pair.split('/');
  const end = new Date();
  const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * 180); // ~180 days
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url = 'https://api.exchangerate.host/timeseries';
  const res = await axios.get(url, { params: { start_date: fmt(start), end_date: fmt(end), base: fromSym, symbols: toSym } });
  const rates = res.data?.rates;
  if (!rates) throw new Error('exchangerate.host timeseries empty');
  const dates = Object.keys(rates).sort((a, b) => a.localeCompare(b));
  const closes = dates.map((d) => Number(rates[d]?.[toSym] ?? NaN)).filter((n) => Number.isFinite(n));
  if (!closes.length) throw new Error('exchangerate.host no numeric closes');
  return { closes };
}

/**
 * Fetch historical crypto prices from CoinGecko
 */
async function fetchCryptoHistoricalData(pair: string, timeframe: string): Promise<PriceSeries> {
  const sym = pair.split('/')[0].toLowerCase();
  // Map common symbols to CoinGecko IDs
  const ID_MAP: Record<string, string> = {
    btc: 'bitcoin', eth: 'ethereum', sol: 'solana', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', ltc: 'litecoin',
    bnb: 'binancecoin', dot: 'polkadot', avax: 'avalanche-2', link: 'chainlink', matic: 'matic-network', trx: 'tron',
    shib: 'shiba-inu', bch: 'bitcoin-cash', xlm: 'stellar', near: 'near', uni: 'uniswap'
  };
  const id = ID_MAP[sym] ?? sym;
  const isDaily = timeframe === '1D';
  // Use market_chart with appropriate interval for intraday freshness
  const useHourly = timeframe === '1H' || timeframe === '4H';
  const useMinutely = timeframe === '1m' || timeframe === '5m' || timeframe === '15m' || timeframe === '30m';
  let params: any;
  if (isDaily) {
    params = { vs_currency: 'usd', days: '400', interval: 'daily' };
  } else if (useHourly) {
    params = { vs_currency: 'usd', days: '14', interval: 'hourly' };
  } else if (useMinutely) {
    // minutely only available when days <= 1
    params = { vs_currency: 'usd', days: '1', interval: 'minutely' };
  } else {
    params = { vs_currency: 'usd', days: '30', interval: 'hourly' };
  }
  try {
    const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, { params });
    const prices = response.data?.prices as Array<[number, number]> | undefined;
    if (!(prices?.length)) throw new Error('No price data received from CoinGecko');
    const closesRaw = prices.map((p) => p[1]);
    // Downsample for 4H from hourly
    if (timeframe === '4H') {
      const ds: number[] = [];
      for (let i = 0; i < closesRaw.length; i += 4) ds.push(closesRaw[Math.min(i + 3, closesRaw.length - 1)]);
      return { closes: ds };
    }
    return { closes: closesRaw };
  } catch (e) {
    // Fallback to OHLC endpoint if market_chart path fails or rate limited
    try {
      const days = isDaily ? '400' : (useHourly ? '14' : '1');
      const resp = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/ohlc`, { params: { vs_currency: 'usd', days } });
      const ohlc = resp.data as Array<[number, number, number, number, number]>;
      if (!Array.isArray(ohlc) || !ohlc.length) throw new Error('OHLC empty');
      const closes = ohlc.map(c => c[4]);
      const highs = ohlc.map(c => c[2]);
      const lows = ohlc.map(c => c[3]);
      if (timeframe === '4H') {
        const dsClose: number[] = []; const dsHigh: number[] = []; const dsLow: number[] = [];
        for (let i = 0; i < closes.length; i += 4) {
          const end = Math.min(i + 3, closes.length - 1);
          dsClose.push(closes[end]);
          dsHigh.push(Math.max(...highs.slice(i, end + 1)));
          dsLow.push(Math.min(...lows.slice(i, end + 1)));
        }
        return { closes: dsClose, highs: dsHigh, lows: dsLow };
      }
      return { closes, highs, lows };
    } catch {
      throw e;
    }
  }
}

/**
 * Fetch historical forex data using a sequential provider strategy with low complexity.
 */
async function fetchForexHistoricalData(pair: string, timeframe: string): Promise<PriceSeries> {
  const [fromSym, toSym] = pair.split('/');
  const apikey = process.env.ALPHA_VANTAGE_API_KEY || '';

  // Build provider fetchers in priority order
  const providers: Array<() => Promise<PriceSeries | null>> = [
    // Alpha Vantage intraday (for intraday timeframes)
    async () => {
      const mapTfToAV: Record<string, string> = { '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min', '1H': '60min', '4H': '60min' };
      const isDaily = timeframe === '1D';
      const interval = mapTfToAV[timeframe];
      if (!apikey || isDaily || !interval) return null;
      const closes = await fetchFxIntradayAlpha(fromSym, toSym, interval, apikey);
      if (!closes?.length) return null;
      return { closes: timeframe === '4H' ? downsampleFor4H(closes) : closes };
    },
    // Alpha Vantage daily
    async () => {
      const closes = await fetchFxDailyAlpha(fromSym, toSym, apikey);
      return closes?.length ? { closes } : null;
    },
    // Yahoo Finance chart
    async () => {
      const isDaily = timeframe === '1D';
      const symbol = `${fromSym}${toSym}=X`;
      const closes = await fetchFxYahooCloses(symbol, timeframe, isDaily);
      if (!closes?.length) return null;
      return { closes: timeframe === '4H' ? downsampleFor4H(closes) : closes };
    },
    // Exchangerate.host timeseries (daily)
    async () => {
      try { return await fetchForexTimeseriesFallback(pair); } catch { return null; }
    },
  ];

  for (const p of providers) {
    try {
      const series = await p();
      if (series?.closes?.length) return series;
    } catch {
      // continue to next provider
    }
  }
  // Synthetic last resort
  const basePrice = 1.1;
  const closes = Array.from({ length: 120 }, (_, i) => basePrice + Math.sin(i / 6) * 0.01 + (Math.random() - 0.5) * 0.002);
  return { closes };
}

/**
 * Fetch historical price data for a trading pair
 */
async function fetchHistoricalData(pair: string, timeframe: string = '1H'): Promise<PriceSeries> {
  const key = cacheKey(pair, timeframe);
  const now = Date.now();
  const cached = memoryCache[key];
  // Cache TTL by timeframe: shorter for intraday, longer for daily
  let ttl: number;
  if (timeframe === '1D') ttl = 1000 * 60 * 30;
  else if (timeframe === '4H') ttl = 1000 * 60 * 2;
  else ttl = 1000 * 60; // 1m..1H -> 60s
  if (cached && now - cached.ts < ttl) {
    return { closes: cached.data };
  }
  try {
    const series = isCrypto(pair) ? await fetchCryptoHistoricalData(pair, timeframe) : await fetchForexHistoricalData(pair, timeframe);
    const sliceLen = HISTORY_LOOKBACK[timeframe] || 120;
    const closes = series.closes.slice(-sliceLen);
    const highs = series.highs?.slice(-sliceLen);
    const lows = series.lows?.slice(-sliceLen);
    memoryCache[key] = { ts: now, data: series.closes }; // store full fetched closes for reuse
    return { closes, highs, lows };
  } catch (e) {
    console.error('Historical fetch failed, fallback data', e instanceof Error ? e.message : e);
    const fallback = generateFallbackData(pair);
    return { closes: fallback };
  }
}

/**
 * Calculate technical indicators from price data
 */
function calculateIndicators(prices: PriceSeries, timeframe: string) {
  const { closes, highs, lows } = prices;
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const smaValues = SMA.calculate({ values: closes, period: 50 });
  const sma200Values = SMA.calculate({ values: closes, period: Math.min(200, closes.length) });
  const cfg = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG['1H'];
  const macdSeries = MACD.calculate({ values: closes, fastPeriod: cfg.macdFast, slowPeriod: cfg.macdSlow, signalPeriod: cfg.macdSignal, SimpleMAOscillator: false, SimpleMASignal: false });
  const macdLast = macdSeries[macdSeries.length - 1];
  const lastClose = closes[closes.length - 1];
  const lastRSI = rsiValues[rsiValues.length - 1] || 50;
  const lastSMA = smaValues[smaValues.length - 1] || lastClose;
  const ema20 = EMA.calculate({ values: closes, period: Math.min(20, closes.length) });
  const ema50 = EMA.calculate({ values: closes, period: Math.min(50, closes.length) });
  let atr: number | undefined = undefined;
  if (highs && lows && highs.length === closes.length && lows.length === closes.length) {
    const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period: Math.min(14, closes.length) });
    atr = atrValues[atrValues.length - 1];
  }
  return { lastClose, lastRSI, lastSMA, sma200: sma200Values[sma200Values.length - 1] || lastClose, ema20: ema20[ema20.length - 1], ema50: ema50[ema50.length - 1], atr, macd: macdLast?.MACD, macdSignal: macdLast?.signal, macdHist: macdLast?.histogram };
}

/**
 * Determine signal type based on technical indicators
 */
function determineSignalType(lastClose: number, lastSMA: number, lastRSI: number, macdHist?: number): SignalType {
  // Layered conditions with MACD confirmation
  if (lastClose > lastSMA && lastRSI < 35 && (macdHist ?? 0) > 0) return 'Buy';
  if (lastClose < lastSMA && lastRSI > 65 && (macdHist ?? 0) < 0) return 'Sell';
  return 'Hold';
}

// --- Points of Interest (POI) helpers ---
function checkExtrema(values: number[], i: number, window: number) {
  let isHigh = true, isLow = true;
  const v = values[i];
  for (let j = i - window; j <= i + window; j++) {
    if (values[j] > v) isHigh = false;
    if (values[j] < v) isLow = false;
    if (!isHigh && !isLow) break;
  }
  return { isHigh, isLow, price: v };
}
function findSwingPoints(values: number[], window: number) {
  const highs: { index: number; price: number }[] = [];
  const lows: { index: number; price: number }[] = [];
  const n = values.length;
  for (let i = window; i < n - window; i++) {
    const { isHigh, isLow, price } = checkExtrema(values, i, window);
    if (isHigh) {
      highs.push({ index: i, price });
    } else if (isLow) {
      lows.push({ index: i, price });
    }
  }
  return { highs, lows };
}

function computeFibLevels(from: number, to: number) {
  const range = to - from;
  // Standard retracement set
  return [0.382, 0.5, 0.618].map(r => to - range * r);
}

function buildPOIs(closes: number[], highs?: number[], lows?: number[]) {
  const baseSeries = closes; // fall back to closes if OHLC not present
  const window = Math.max(2, Math.floor(baseSeries.length / 40)); // adaptive
  const swings = findSwingPoints(baseSeries, window);
  const lastHigh = swings.highs[swings.highs.length - 1];
  const lastLow = swings.lows[swings.lows.length - 1];
  let fibs: number[] = [];
  if (lastHigh && lastLow) {
    if (lastLow.index < lastHigh.index) {
      // up move
      fibs = computeFibLevels(lastLow.price, lastHigh.price);
    } else {
      // down move, invert
      const inv = computeFibLevels(lastHigh.price, lastLow.price);
      fibs = inv;
    }
  }
  // Define supply/demand zones around last swings with narrow pads
  const demandZone = lastLow ? { low: lastLow.price * 0.999, high: lastLow.price * 1.001 } : undefined;
  const supplyZone = lastHigh ? { low: lastHigh.price * 0.999, high: lastHigh.price * 1.001 } : undefined;
  return { swings, fibs, demandZone, supplyZone };
}

function near(value: number, target: number, tol: number) {
  return Math.abs(value - target) <= tol;
}

function nearAny(value: number, targets: number[], tol: number) {
  return targets.some(t => near(value, t, tol));
}

function withinZone(value: number, zone?: { low: number; high: number }, tol = 0) {
  if (!zone) return false;
  return value >= zone.low - tol && value <= zone.high + tol;
}

export function decideTypeWithPOI(
  techType: SignalType,
  fundamentalsScore: number,
  lastClose: number,
  atr: number | undefined,
  volatility: number,
  isCryptoAsset: boolean,
  opts: { demandZone?: { low: number; high: number }; supplyZone?: { low: number; high: number }; fibs: number[] }
): SignalType {
  const priceTol = Math.max((atr ?? volatility) * 0.2, lastClose * (isCryptoAsset ? 0.005 : 0.001));
  const nearDemand = withinZone(lastClose, opts.demandZone, priceTol);
  const nearSupply = withinZone(lastClose, opts.supplyZone, priceTol);
  const nearFib = opts.fibs.length ? nearAny(lastClose, opts.fibs, priceTol) : false;
  const fundBias = getFundBias(fundamentalsScore);
  const techBias = getTechBias(techType);
  switch (techBias) {
    case 'bull':
      if ((nearDemand || nearFib) && fundBias !== 'bear') return 'Buy';
      break;
    case 'bear':
      if ((nearSupply || nearFib) && fundBias !== 'bull') return 'Sell';
      break;
    default:
      break;
  }
  return 'Hold';
}

export function computeLevels(
  type: SignalType,
  lastClose: number,
  atr: number | undefined,
  volatility: number,
  isCryptoAsset: boolean,
  opts: { demandZone?: { low: number; high: number }; supplyZone?: { low: number; high: number } }
) {
  const entry = lastClose;
  const slDist = atr ?? (isCryptoAsset ? entry * 0.01 : entry * 0.003);
  const priceTol = Math.max((atr ?? volatility) * 0.2, lastClose * (isCryptoAsset ? 0.005 : 0.001));
  let sl = type === 'Sell' ? entry + slDist : entry - slDist;
  let tp = type === 'Sell' ? entry - slDist * 2 : entry + slDist * 2;
  if (type === 'Buy') {
    if (opts.demandZone) sl = Math.min(sl, opts.demandZone.low - priceTol);
    if (opts.supplyZone) tp = Math.max(tp, opts.supplyZone.high + priceTol);
  } else if (type === 'Sell') {
    if (opts.supplyZone) sl = Math.max(sl, opts.supplyZone.high + priceTol);
    if (opts.demandZone) tp = Math.min(tp, opts.demandZone.low - priceTol);
  }
  return { entry, sl, tp };
}

// --- FX historical fetch helpers (top-level) ---
async function fetchFxIntradayAlpha(fromSym: string, toSym: string, interval: string, apikey: string): Promise<number[] | null> {
  const response = await axios.get('https://www.alphavantage.co/query', {
    params: { function: 'FX_INTRADAY', from_symbol: fromSym, to_symbol: toSym, interval, apikey, outputsize: 'compact' }
  });
  const key = `Time Series FX (${interval})`;
  const ts = response.data?.[key];
  if (!ts) return null;
  const entries = Object.values(ts);
  const sliced = (entries as Array<Record<string, string>>).slice(0, 300);
  const closes: number[] = [];
  sliced.forEach((d: Record<string, string>) => { closes.push(parseFloat(d['4. close'])); });
  return closes.reverse();
}

async function fetchFxDailyAlpha(fromSym: string, toSym: string, apikey: string): Promise<number[] | null> {
  const response = await axios.get('https://www.alphavantage.co/query', {
    params: { function: 'FX_DAILY', from_symbol: fromSym, to_symbol: toSym, apikey, outputsize: 'full' }
  });
  const ts = response.data?.['Time Series (FX)'];
  if (!ts) return null;
  return Object.values(ts).map((d: any) => parseFloat(d['4. close'])).reverse();
}

async function fetchFxYahooCloses(symbol: string, timeframe: string, isDaily: boolean): Promise<number[] | null> {
  let yfInterval = '60m';
  if (timeframe === '1m') yfInterval = '1m';
  else if (timeframe === '5m') yfInterval = '5m';
  else if (timeframe === '15m') yfInterval = '15m';
  else if (timeframe === '30m') yfInterval = '30m';
  let range = '5d';
  if (isDaily) range = '1y';
  else if (timeframe === '1H' || timeframe === '4H') range = '1mo';
  const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, {
    params: { interval: isDaily ? '1d' : yfInterval, range }
  });
  const closes = res.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close as number[] | undefined;
  if (!(closes?.length)) return null;
  return closes;
}

// Utility to downsample hourly closes to 4H blocks by taking the last close of each 4-period block
function downsampleFor4H(closes: number[], factor = 4): number[] {
  if (!Array.isArray(closes) || closes.length === 0) return closes;
  const out: number[] = [];
  for (let i = 0; i < closes.length; i += factor) {
    out.push(closes[Math.min(i + factor - 1, closes.length - 1)]);
  }
  return out;
}
function buildPoiExplanation(
  demandZone?: { low: number; high: number },
  supplyZone?: { low: number; high: number },
  fibs: number[] = []
): string {
  const parts: string[] = [];
  if (demandZone) parts.push(`Demand ${demandZone.low.toFixed(4)}-${demandZone.high.toFixed(4)}`);
  if (supplyZone) parts.push(`Supply ${supplyZone.low.toFixed(4)}-${supplyZone.high.toFixed(4)}`);
  if (fibs?.length) parts.push(`Fibs ${fibs.slice(-3).map(f => f.toFixed(4)).join(',')}`);
  return parts.join(' | ') || 'No POIs';
}
function formatMACD(hist?: number) {
  if (hist == null || !Number.isFinite(hist)) return 'MACD n/a';
  let bias = 'flat';
  if (hist > 0) bias = 'bullish';
  else if (hist < 0) bias = 'bearish';
  return `MACD hist ${hist.toFixed(3)} (${bias})`;
}

function calcVolatility(closes: number[]): number {
  if (!closes.length) return 0;
  const n = Math.min(50, closes.length - 1);
  if (n <= 1) return 0;
  const slice = closes.slice(-n);
  const deltas: number[] = [];
  for (let i = 1; i < slice.length; i++) deltas.push(Math.abs(slice[i] - slice[i - 1]));
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const variance = deltas.reduce((a, b) => a + (b - mean) * (b - mean), 0) / deltas.length;
  return Math.sqrt(variance);
}

function getFundBias(score: number): DirectionBias {
  if (score > 55) return 'bull';
  if (score < 45) return 'bear';
  return 'neutral';
}
function getTechBias(t: SignalType): DirectionBias {
  if (t === 'Buy') return 'bull';
  if (t === 'Sell') return 'bear';
  return 'neutral';
}

// Build a structured explanation object for UI and a concise flat string
function generateStructuredExplanation(input: {
  type: SignalType;
  lastClose: number;
  lastSMA: number;
  sma200: number;
  ema20?: number;
  ema50?: number;
  lastRSI: number;
  macdHist?: number;
  fundamentalsScore: number;
  fundamentalsFactors: string[];
  volatilityPct: number;
  riskReward: number;
  riskCategory: RiskCategory;
}): { flatExplanation: string; sections: { title: string; details: string[] }[] } {
  const {
    type,
    lastClose,
    lastSMA,
    sma200,
    ema20,
    ema50,
    lastRSI,
    macdHist,
    fundamentalsScore,
    fundamentalsFactors,
    volatilityPct,
    riskReward,
    riskCategory,
  } = input;

  const trend: string[] = [];
  trend.push(`Price ${lastClose.toFixed(4)} vs SMA50 ${lastSMA.toFixed(4)}`);
  trend.push(`SMA200 ${sma200.toFixed(4)} (${lastClose > sma200 ? 'above' : 'below'})`);
  if (ema20 != null && ema50 != null) trend.push(`EMA20 ${ema20.toFixed(4)} vs EMA50 ${ema50.toFixed(4)}`);

  let rsiState: 'oversold' | 'overbought' | 'neutral' = 'neutral';
  if (lastRSI < 30) rsiState = 'oversold';
  else if (lastRSI > 70) rsiState = 'overbought';
  const momentum = [`RSI ${lastRSI.toFixed(1)} (${rsiState})`, formatMACD(macdHist)];

  const fundHeader = `Fundamentals ${Math.round(fundamentalsScore)}/100`;
  const fundDetails = fundamentalsFactors?.length ? fundamentalsFactors.slice(0, 4) : [];

  const risk = [`Risk ${riskCategory}`, `Vol ${volatilityPct.toFixed(2)}%`, `RR ${riskReward.toFixed(2)}`];

  const sections = [
    { title: 'Signal', details: [`Type ${type}`] },
    { title: 'Trend & MAs', details: trend },
    { title: 'Momentum', details: momentum },
    { title: 'Fundamentals', details: [fundHeader, ...fundDetails] },
    { title: 'Risk', details: risk },
  ];
  const flatExplanation = [sections[0].details[0], trend[1], momentum[0], momentum[1], risk.join(', ')].filter(Boolean).join(' | ');
  return { flatExplanation, sections };
}
/** Fetches historical close prices and computes a trading signal */
export async function calculateSignal(pair: string, timeframe: string = '1H'): Promise<FullSignalResult> {
  // Fetch historical data
  const series = await fetchHistoricalData(pair, timeframe);
  const volatility = calcVolatility(series.closes);
  const { lastClose, lastRSI, lastSMA, sma200, ema20, ema50, atr, macd, macdSignal, macdHist } = calculateIndicators(series, timeframe);
  // Determine type
  const techType = determineSignalType(lastClose, lastSMA, lastRSI, macdHist);
  const above200 = lastClose > sma200 ? 1 : 0;
  const macdBias = macdBiasValue(macdHist);
  const macdScore = macdBiasScore(macdBias);
  const fundamentals = await fetchFundamentalData(pair, timeframe);
  const rsiNeutrality = 1 - Math.abs(50 - lastRSI) / 50;
  const trendUp = lastClose > (ema50 ?? lastSMA) ? 1 : 0;
  const technicalComposite = (
    (trendUp * 0.25) +
    (above200 * 0.2) +
    (macdScore * 0.2) +
    ((lastRSI < 30 || lastRSI > 70 ? 1 : rsiNeutrality) * 0.15) +
    (volatility > 0 ? Math.max(0, 1 - (volatility / lastClose) * 5) * 0.2 : 0)
  );
  let confidence = Math.round(technicalComposite * 60 + fundamentals.score * 0.4);
  confidence = Math.max(0, Math.min(100, confidence));
  if (volatility > 0 && volatility / lastClose > 0.02) confidence = Math.max(0, confidence - 5);
  const { fibs, demandZone, supplyZone } = buildPOIs(series.closes, series.highs, series.lows);
  const isC = isCrypto(pair);
  const type = decideTypeWithPOI(techType, fundamentals.score, lastClose, atr, volatility, isC, { demandZone, supplyZone, fibs });
  const levels = computeLevels(type, lastClose, atr, volatility, isC, { demandZone, supplyZone });
  const riskReward = (levels.tp - levels.entry) / Math.max(1e-8, (levels.entry - levels.sl));
  const riskCategory = classifyRisk(volatility / lastClose);
  const volatilityPct = (volatility / lastClose) * 100;
  const compositeScore = Math.round(technicalComposite * 100);
  const currentPrice = await fetchCurrentPrice(pair, lastClose);
  let displayLevels = levels;
  if (shouldReanchorLevels({ pair, isCrypto: isC, lastClose, currentPrice, atr, volatility })) {
    displayLevels = computeLevels(type, currentPrice, atr, volatility, isC, { demandZone, supplyZone });
  }
  const effectiveRiskReward = (displayLevels.tp - displayLevels.entry) / Math.max(1e-8, (displayLevels.entry - displayLevels.sl));
  const explanationData = generateStructuredExplanation({
    type,
    lastClose,
    lastSMA,
    sma200,
    ema20,
    ema50,
    lastRSI,
    macdHist,
    fundamentalsScore: fundamentals.score,
    fundamentalsFactors: fundamentals.factors,
    volatilityPct,
    riskReward,
    riskCategory
  });
  const explanation = [
    explanationData.flatExplanation,
    `POIs: ${buildPoiExplanation(demandZone, supplyZone, fibs)}`,
    displayLevels !== levels ? 'Anchored to live price' : undefined
  ].filter(Boolean).join(' | ');
  return {
    pair,
    assetClass: isC ? 'Crypto' : 'Forex',
    type,
    confidence,
    timeframe,
    buyLevel: parseFloat((displayLevels.entry || currentPrice).toFixed(4)),
    stopLoss: parseFloat(displayLevels.sl.toFixed(4)),
    takeProfit: parseFloat(displayLevels.tp.toFixed(4)),
    explanation,
    stale: false,
    news: fundamentals.news,
    indicators: { rsi: lastRSI, sma50: lastSMA, sma200, ema20, ema50, atr, macd, macdSignal, macdHist },
    fundamentals: { score: fundamentals.score, factors: fundamentals.factors },
    riskReward: effectiveRiskReward,
    riskCategory,
    volatilityPct,
    compositeScore,
    history: series.closes.slice(-120),
    technicalScore: Math.round(technicalComposite * 100),
    fundamentalScore: fundamentals.score,
    explanationSections: explanationData.sections,
  };
}

function macdBiasValue(hist?: number): number {
  if (hist == null) return 0;
  if (hist > 0) return 1;
  if (hist < 0) return -1;
  return 0;
}
function macdBiasScore(bias: number): number {
  if (bias > 0) return 1;
  if (bias < 0) return 0;
  return 0.5;
}
function classifyRisk(volRatio: number): RiskCategory {
  if (volRatio < 0.005) return 'Low';
  if (volRatio < 0.015) return 'Medium';
  return 'High';
}

async function fetchCurrentPrice(pair: string, fallbackPrice: number): Promise<number> {
  try {
    const { getCryptoPrice, getForexPrice } = await import('./api');
    let price = 0;
    if (isCrypto(pair)) {
      const priceData = await getCryptoPrice(pair);
      price = Number(priceData.price) || 0;
    } else {
      const priceData = await getForexPrice(pair);
      price = Number(priceData.price) || 0;
    }
    // If external price providers failed or returned 0/NaN, fall back to last known close
    if (!Number.isFinite(price) || price <= 0) return fallbackPrice;
    return price;
  } catch (e) {
    console.warn('fetchCurrentPrice failed, using fallback', e instanceof Error ? e.message : e);
    return fallbackPrice;
  }
}
