import axios from 'axios';
import { RSI, SMA, MACD, EMA, ATR } from 'technicalindicators';
// Removed unused direct imports; fetchCurrentPrice will import lazily below
import { fetchFundamentalData } from './fundamentals';

// Type aliases (code quality / reuse)
export type SignalType = 'Buy' | 'Sell' | 'Hold';
export type RiskCategory = 'Low' | 'Medium' | 'High';

export interface FullSignalResult {
  pair: string;
  assetClass: 'Forex' | 'Crypto';
  type: SignalType;
  confidence: number;
  timeframe: string;
  buyLevel: number;
  stopLoss: number;
  takeProfit: number;
  explanation: string;
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

const HISTORY_LOOKBACK: Record<string, number> = { '1m': 300, '5m': 300, '15m': 200, '30m': 180, '1H': 120, '4H': 90, '1D': 365 };

/**
 * Check if a trading pair is a cryptocurrency
 */
const isCrypto = (pair: string): boolean => /USDT$|USD$/.exec(pair) !== null;

/**
 * Generate fallback mock data when API calls fail
 */
const generateFallbackData = (pair: string): number[] => {
  const basePrice = isCrypto(pair) ? 50000 : 1.1;
  const variance = isCrypto(pair) ? 1000 : 0.1;
  return Array.from({length: 30}, () => basePrice + Math.random() * variance);
};

const memoryCache: Record<string, { ts: number; data: number[] }> = {};
function cacheKey(pair: string, tf: string) { return `${pair}:${tf}`; }

/**
 * Fetch historical crypto prices from CoinGecko
 */
interface PriceSeries { closes: number[]; highs?: number[]; lows?: number[]; }

async function fetchCryptoHistoricalData(pair: string, timeframe: string): Promise<PriceSeries> {
  const id = pair.split('/')[0].toLowerCase();
  // For daily timeframe request longer history for better long-term indicators
  const wantExtended = timeframe === '1D';
  try {
    // Try OHLC endpoint for richer data (limit to 365 when extended else 30)
    const daysParam = wantExtended ? 365 : 30;
    const ohlc = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/ohlc`, {
      params: { vs_currency: 'usd', days: daysParam }
    });
    if (Array.isArray(ohlc.data) && ohlc.data.length) {
      const closes: number[] = [];
      const highs: number[] = [];
      const lows: number[] = [];
      ohlc.data.forEach((row: any) => {
        const [, , high, low, close] = row; // [t, open, high, low, close]
        highs.push(high);
        lows.push(low);
        closes.push(close);
      });
      return { closes, highs, lows };
    }
  } catch (e) {
    console.warn('OHLC fetch failed, fallback to market_chart', e instanceof Error ? e.message : e);
  }
  // Fallback to market_chart close-only (supports arbitrary days up to ~max)
  const days = timeframe === '1D' ? '400' : '30';
  const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, {
    params: { vs_currency: 'usd', days, interval: 'daily' }
  });
  if (!response.data?.prices) throw new Error('No price data received from CoinGecko');
  const closes = response.data.prices.map((p: [number, number]) => p[1]);
  return { closes };
}

/**
 * Fetch historical forex data from Alpha Vantage
 */
async function fetchForexHistoricalData(pair: string, timeframe: string): Promise<PriceSeries> {
  console.log('Fetching forex data for:', pair);
  const [fromSym, toSym] = pair.split('/');
  // Use full output when daily timeframe to obtain >200 bars for SMA200
  const wantExtended = timeframe === '1D';
  const response = await axios.get('https://www.alphavantage.co/query', {
    params: { function: 'FX_DAILY', from_symbol: fromSym, to_symbol: toSym, apikey: process.env.ALPHA_VANTAGE_API_KEY || '', outputsize: wantExtended ? 'full' : 'compact' }
  });
  const ts = response.data?.['Time Series (FX)'];
  if (!ts) throw new Error('No forex data received from Alpha Vantage');
  const rawEntries = Object.values(ts);
  const entries: { [k: string]: string }[] = rawEntries.map(e => e as { [k: string]: string }); // map to typed objects
  // Keep last N (ensure at least 400 if extended available)
  const sliceCount = wantExtended ? 400 : 60;
  const sliced = entries.slice(0, sliceCount);
  const closes: number[] = []; const highs: number[] = []; const lows: number[] = [];
  sliced.forEach(d => { closes.push(parseFloat(d['4. close'])); highs.push(parseFloat(d['2. high'])); lows.push(parseFloat(d['3. low'])); });
  const revCloses = [...closes].reverse();
  const revHighs = [...highs].reverse();
  const revLows = [...lows].reverse();
  return { closes: revCloses, highs: revHighs, lows: revLows };
}

/**
 * Fetch historical price data for a trading pair
 */
async function fetchHistoricalData(pair: string, timeframe: string = '1H'): Promise<PriceSeries> {
  const key = cacheKey(pair, timeframe);
  const now = Date.now();
  const cached = memoryCache[key];
  // Longer cache for daily extended data (30 min) vs intraday (5 min)
  const ttl = timeframe === '1D' ? 1000 * 60 * 30 : 1000 * 60 * 5;
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
function determineSignalType(lastClose: number, lastSMA: number, lastRSI: number, macdHist?: number): 'Buy' | 'Sell' | 'Hold' {
  // Layered conditions with MACD confirmation
  if (lastClose > lastSMA && lastRSI < 35 && (macdHist ?? 0) > 0) return 'Buy';
  if (lastClose < lastSMA && lastRSI > 65 && (macdHist ?? 0) < 0) return 'Sell';
  return 'Hold';
}

/**
 * Calculate volatility as average price change
 */
function calcVolatility(closes: number[]): number {
  if (closes.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < closes.length; i++) {
    sum += Math.abs(closes[i] - closes[i-1]);
  }
  return sum / (closes.length - 1);
}

function formatRSI(lastRSI?: number): string {
  if (lastRSI == null) return 'RSI n/a';
  let state: string;
  if (lastRSI < 30) state = 'Oversold'; else if (lastRSI > 70) state = 'Overbought'; else state = 'Neutral';
  return `RSI ${lastRSI.toFixed(1)} (${state})`;
}
function formatMACD(macdHist?: number): string {
  if (macdHist == null) return 'MACD n/a';
  let state: string;
  if (macdHist > 0) state = 'Bullish momentum'; else if (macdHist < 0) state = 'Bearish momentum'; else state = 'Flat';
  return `MACD Histogram ${macdHist.toFixed(2)} (${state})`;
}
function buildSections(base: {
  type: SignalType; lastClose: number; lastSMA: number; sma200: number; ema20?: number; ema50?: number; lastRSI?: number; macdHist?: number; fundamentalsScore?: number; fundamentalsFactors?: string[]; volatilityPct?: number; riskReward?: number; riskCategory?: string;
}) {
  const confidenceDescriptor = base.fundamentalsScore != null ? 'w/ fundamentals' : 'technical only';
  const overview = [
    `Signal: ${base.type}`,
    `Price ${base.lastClose.toFixed(4)}`,
    `Confidence derived from blended technical (${confidenceDescriptor})`,
  ];
  const emaLine = (base.ema20 && base.ema50) ? `EMA20 ${base.ema20.toFixed(2)} / EMA50 ${base.ema50.toFixed(2)}` : 'EMAs insufficient data';
  const technical = [
    `SMA50 ${base.lastSMA.toFixed(2)} | SMA200 ${base.sma200.toFixed(2)}`,
    emaLine,
    formatRSI(base.lastRSI),
    formatMACD(base.macdHist),
  ];
  const fundamentals = base.fundamentalsFactors && base.fundamentalsFactors.length > 0 ? base.fundamentalsFactors : ['Fundamentals unavailable'];
  const risk = [
    base.volatilityPct != null ? `Volatility ${base.volatilityPct.toFixed(2)}%` : 'Volatility n/a',
    base.riskCategory ? `Risk category ${base.riskCategory}` : 'Risk category n/a',
    base.riskReward != null ? `Risk/Reward ${base.riskReward.toFixed(2)}` : 'R/R n/a'
  ];
  return [
    { title: 'Overview', details: overview },
    { title: 'Technical', details: technical },
    { title: 'Fundamentals', details: fundamentals },
    { title: 'Risk', details: risk }
  ];
}
function generateStructuredExplanation(input: {
  type: SignalType;
  lastClose: number;
  lastSMA: number;
  sma200: number;
  ema20?: number;
  ema50?: number;
  lastRSI?: number;
  macdHist?: number;
  fundamentalsScore?: number;
  fundamentalsFactors?: string[];
  volatilityPct?: number;
  riskReward?: number;
  riskCategory?: string;
}) {
  const sections = buildSections(input);
  const flatExplanation = sections.map(s => `${s.title}: ${s.details.join('; ')}`).join(' | ');
  return { sections, flatExplanation };
}

/**
 * Fetches historical close prices and computes a trading signal
 */
export async function calculateSignal(pair: string, timeframe: string = '1H'): Promise<FullSignalResult> {
  console.log('Calculating signal for:', pair, 'timeframe:', timeframe);
  
  // Fetch historical data (extended depth automatically handled inside for 1D timeframe)
  const series = await fetchHistoricalData(pair, timeframe);
  const volatility = calcVolatility(series.closes);
  const { lastClose, lastRSI, lastSMA, sma200, ema20, ema50, atr, macd, macdSignal, macdHist } = calculateIndicators(series, timeframe);
  
  // Determine signal type and confidence
  const type = determineSignalType(lastClose, lastSMA, lastRSI, macdHist);
  // Trend momentum score
  const trendUp = lastClose > (ema50 ?? lastSMA) ? 1 : 0;
  const above200 = lastClose > sma200 ? 1 : 0;
  const macdBias = macdBiasValue(macdHist);
  const macdScore = macdBiasScore(macdBias);
  // Fetch fundamentals early for composite
  const fundamentals = await fetchFundamentalData(pair);
  const rsiNeutrality = 1 - Math.abs(50 - lastRSI) / 50;
  const technicalComposite = (
    (trendUp * 0.25) +
    (above200 * 0.2) +
    (macdScore * 0.2) +
    ((lastRSI < 30 || lastRSI > 70 ? 1 : rsiNeutrality) * 0.15) +
    (volatility > 0 ? Math.max(0, 1 - (volatility / lastClose) * 5) * 0.2 : 0)
  );
  let confidence = Math.round(technicalComposite * 60 + fundamentals.score * 0.4); // blend fundamental influence
  confidence = Math.max(0, Math.min(100, confidence));
  if (volatility > 0 && volatility / lastClose > 0.02) confidence = Math.max(0, confidence - 5);
  // Risk / reward estimation based on naive levels
  const provisionalEntry = lastClose;
  const sl = provisionalEntry * 0.95;
  const tp = provisionalEntry * 1.05;
  const riskReward = (tp - provisionalEntry) / (provisionalEntry - sl);
  const riskCategory = classifyRisk(volatility / lastClose);
  const volatilityPct = (volatility / lastClose) * 100;
  const compositeScore = Math.round(technicalComposite * 100);
  
  // Fetch current price for levels
  const price = await fetchCurrentPrice(pair, lastClose);
  
  // Generate explanation
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
  const explanation = explanationData.flatExplanation; // keep legacy string

  return {
    pair,
    assetClass: isCrypto(pair) ? 'Crypto' : 'Forex',
    type,
    confidence,
    timeframe,
    buyLevel: parseFloat((price * 0.98).toFixed(4)),
    stopLoss: parseFloat((price * 0.95).toFixed(4)),
    takeProfit: parseFloat((price * 1.05).toFixed(4)),
    explanation,
    news: fundamentals.news,
    indicators: { rsi: lastRSI, sma50: lastSMA, sma200, ema20, ema50, atr, macd, macdSignal, macdHist },
    fundamentals: { score: fundamentals.score, factors: fundamentals.factors },
    riskReward,
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
    if (isCrypto(pair)) {
      const priceData = await getCryptoPrice(pair);
      return priceData.price;
    } else {
      const priceData = await getForexPrice(pair);
      return priceData.price;
    }
  } catch (e) {
    console.warn('fetchCurrentPrice failed, using fallback', e instanceof Error ? e.message : e);
    return fallbackPrice;
  }
}
