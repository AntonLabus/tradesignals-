import { RSI, SMA, MACD, EMA } from 'technicalindicators';
import axios from 'axios';

// Determine desired backtest lookback length per timeframe
function desiredLookback(timeframe: string): number {
  switch (timeframe) {
    case '1m': return 1500; // ~1 day of minutes
    case '5m': return 2000; // ~1 week of 5m
    case '15m': return 1500;
    case '30m': return 1200;
    case '1H': return 1000;
    case '4H': return 700;
    case '1D': return 800;
    default: return 1000;
  }
}

function isCrypto(pair: string): boolean {
  const base = pair.split('/')[0].toUpperCase();
  return new Set(['BTC','ETH','SOL','XRP','ADA','DOGE','LTC','BNB','DOT','AVAX','LINK','MATIC','TRX','SHIB','BCH','XLM','NEAR','UNI']).has(base);
}

function downsample4H(closes: number[], factor = 4): number[] {
  const out: number[] = [];
  for (let i = 0; i < closes.length; i += factor) out.push(closes[Math.min(i + factor - 1, closes.length - 1)]);
  return out;
}

async function fetchCryptoCloses(pair: string, timeframe: string, want: number): Promise<number[] | null> {
  try {
    const idMap: Record<string, string> = { btc: 'bitcoin', eth: 'ethereum', sol: 'solana', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', ltc: 'litecoin', bnb: 'binancecoin', dot: 'polkadot', avax: 'avalanche-2', link: 'chainlink', matic: 'matic-network', trx: 'tron', shib: 'shiba-inu', bch: 'bitcoin-cash', xlm: 'stellar', near: 'near', uni: 'uniswap' };
    const sym = pair.split('/')[0].toLowerCase();
    const id = idMap[sym] ?? sym;
  // Choose interval based on timeframe
  let params: { vs_currency: 'usd'; days: string; interval: 'daily' | 'hourly' | 'minutely' };
    if (timeframe === '1D') params = { vs_currency: 'usd', days: '400', interval: 'daily' };
    else if (timeframe === '1H' || timeframe === '4H') params = { vs_currency: 'usd', days: '90', interval: 'hourly' };
    else params = { vs_currency: 'usd', days: '1', interval: 'minutely' };
    const res = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, { params, timeout: 9000 });
    const prices = (res.data?.prices as Array<[number, number]> | undefined) ?? [];
    if (!prices.length) return null;
    let closes = prices.map(p => p[1]);
    if (timeframe === '4H' && params.interval === 'hourly') closes = downsample4H(closes, 4);
    // Ensure length
    if (closes.length > want) closes = closes.slice(-want);
    return closes;
  } catch {
    return null;
  }
}

async function fetchFxCloses(pair: string, timeframe: string, want: number): Promise<number[] | null> {
  const [from, to] = pair.split('/');
  const symbol = `${from}${to}=X`;
  try {
    // Map to Yahoo intervals
    let interval = '60m';
    if (timeframe === '1m') interval = '1m';
    else if (timeframe === '5m') interval = '5m';
    else if (timeframe === '15m') interval = '15m';
    else if (timeframe === '30m') interval = '30m';
    let range = '6mo';
    if (timeframe === '1D') range = '2y';
    const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`, { params: { interval: timeframe === '1D' ? '1d' : interval, range }, timeout: 9000 });
    let closes = (res.data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close as number[] | undefined) ?? [];
    if (!closes.length) return null;
    if (timeframe === '4H' && interval.endsWith('60m')) closes = downsample4H(closes, 4);
    if (closes.length > want) closes = closes.slice(-want);
    return closes;
  } catch {
    // daily fallback via exchangerate.host
    try {
      const end = new Date();
      const start = new Date(end.getTime() - 1000 * 60 * 60 * 24 * 365);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const resp = await axios.get('https://api.exchangerate.host/timeseries', { params: { start_date: fmt(start), end_date: fmt(end), base: from, symbols: to }, timeout: 9000 });
      const rates = resp.data?.rates || {};
      const dates = Object.keys(rates).sort((a, b) => a.localeCompare(b));
      const closes = dates.map(d => Number(rates[d]?.[to] ?? NaN)).filter(n => Number.isFinite(n));
      return closes.slice(-want);
    } catch {
      return null;
    }
  }
}

// Minimal historical fetch adapted from signals.ts via API route with provider fallbacks for longer series
async function fetchHistoricalCloses(pair: string, timeframe: string): Promise<number[]> {
  const want = desiredLookback(timeframe);
  // Try internal API for quick path
  const baseEnv = process.env.NEXT_PUBLIC_BASE_URL || process.env.URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');
  const url = `${baseEnv}/api/signals?pairs=${encodeURIComponent(pair)}&timeframe=${encodeURIComponent(timeframe)}&debug=1`;
  try {
    const res = await axios.get(url, { timeout: 8000 });
    const sig = Array.isArray(res.data?.signals) ? res.data.signals.find((s: any) => s?.pair === pair) : res.data;
    const closes: number[] = sig?.history || [];
    if (Array.isArray(closes) && closes.length >= Math.min(200, want)) {
      return closes.slice(-want);
    }
  } catch {
    // ignore
  }
  // Provider fallbacks
  const c = isCrypto(pair);
  const prov = c ? await fetchCryptoCloses(pair, timeframe, want) : await fetchFxCloses(pair, timeframe, want);
  if (prov?.length) return prov.slice(-want);
  // Last resort: synthetic series
  const n = want; const price = c ? 100 : 1.1; const vol = c ? price * 0.01 : 0.002;
  return Array.from({ length: n }, (_, i) => price + Math.sin(i / 6) * vol + (Math.random() - 0.5) * vol * 0.2);
}

export interface BacktestResult {
  pair: string;
  timeframe: string;
  trades: number;
  wins: number;
  winRate: number;
  totalReturnPct: number;
  equityCurve: number[];
  maxDrawdownPct: number;
}

export async function runTechnicalBacktest(pair: string, timeframe: string = '1H', initialCapital = 10000): Promise<BacktestResult> {
  const closes = await fetchHistoricalCloses(pair, timeframe);
  const n = closes.length;
  // Indicators
  const rsi = RSI.calculate({ values: closes, period: 14 });
  const sma50 = SMA.calculate({ values: closes, period: 50 });
  const ema20 = EMA.calculate({ values: closes, period: 20 });
  const ema50 = EMA.calculate({ values: closes, period: 50 });
  const sma200 = SMA.calculate({ values: closes, period: Math.min(200, closes.length) });
  // ATR proxy from close-to-close absolute changes
  const atrPeriod = Number(process.env.NEXT_PUBLIC_BT_ATR_PERIOD ?? process.env.BT_ATR_PERIOD ?? 14);
  const diffs: number[] = [];
  for (let i = 1; i < closes.length; i++) diffs.push(Math.abs(closes[i] - closes[i - 1]));
  const atrProxy = SMA.calculate({ values: diffs, period: Math.max(2, Math.min(atrPeriod, Math.floor(n / 4))) });
  const cfg: Record<string, { f: number; s: number; sig: number }> = {
    '1m': { f: 5, s: 13, sig: 3 }, '5m': { f: 5, s: 13, sig: 3 }, '15m': { f: 8, s: 17, sig: 5 }, '30m': { f: 12, s: 26, sig: 9 },
    '1H': { f: 12, s: 26, sig: 9 }, '4H': { f: 19, s: 39, sig: 9 }, '1D': { f: 12, s: 26, sig: 9 },
  };
  const mc = MACD.calculate({ values: closes, fastPeriod: (cfg[timeframe]||cfg['1H']).f, slowPeriod: (cfg[timeframe]||cfg['1H']).s, signalPeriod: (cfg[timeframe]||cfg['1H']).sig, SimpleMAOscillator: false, SimpleMASignal: false });
  // Align indicator arrays to closes length
  function alignSeries<T>(series: T[], total: number, fill: any): any[] {
    const pad = total - series.length;
    return pad > 0 ? new Array(pad).fill(fill).concat(series) : series.slice(-total);
  }
  const rsiAligned = alignSeries<number>(rsi as any, n, NaN) as number[];
  const sma50Aligned = alignSeries<number>(sma50 as any, n, NaN) as number[];
  const ema20Aligned = alignSeries<number>(ema20 as any, n, NaN) as number[];
  const ema50Aligned = alignSeries<number>(ema50 as any, n, NaN) as number[];
  const macdAligned = alignSeries<any>(mc as any, n, { histogram: NaN });
  const atrPxAligned = alignSeries<number>(atrProxy as any, n, NaN) as number[];
  const sma200Aligned = alignSeries<number>(sma200 as any, n, NaN) as number[];
  const offset = Math.max(50, 20, (cfg[timeframe]||cfg['1H']).s + (cfg[timeframe]||cfg['1H']).sig);
  // Conservative mode favors higher win-rate over trade frequency
  const conservative = (process.env.NEXT_PUBLIC_BT_CONSERVATIVE === '1' || process.env.BT_CONSERVATIVE === '1');
  function getHTFFactor(tf: string): number {
    const map: Record<string, number> = { '1m': 5, '5m': 3, '15m': 4, '30m': 8, '1H': 4, '4H': 6, '1D': 1 };
    return map[tf] ?? 4;
  }
  function emaSlopeUp(vals: number[]): boolean { return vals.length >= 2 && vals[vals.length - 1] > vals[vals.length - 2]; }
  function emaSlopeDown(vals: number[]): boolean { return vals.length >= 2 && vals[vals.length - 1] < vals[vals.length - 2]; }
  function computeHTFTrendUp(values: number[], tf: string): boolean {
    const f = getHTFFactor(tf);
    if (f <= 1) {
      const e50 = EMA.calculate({ values, period: Math.min(50, values.length) });
      return emaSlopeUp(e50);
    }
    const ds: number[] = [];
    for (let i = 0; i < values.length; i += f) ds.push(values[Math.min(i + f - 1, values.length - 1)]);
    const e50 = EMA.calculate({ values: ds, period: Math.min(50, ds.length) });
    return emaSlopeUp(e50);
  }
  const htfUp = computeHTFTrendUp(closes, timeframe);
  const shouldBuy = (px: number, s: number, r: number, hist: number, e20: number, e50: number, s200: number) => (
    conservative
      ? (e20 > e50 && px > s && s > s200 && hist >= 0 && r >= 50 && htfUp)
      : ((e20 > e50 && hist >= 0) || (px > s && r > 50))
  );
  const shouldSell = (px: number, s: number, r: number, hist: number, e20: number, e50: number, s200: number) => (
    conservative
      ? (e20 < e50 && px < s && s < s200 && hist <= 0 && r <= 50 && !htfUp)
      : ((e20 < e50 && hist <= 0) || (px < s && r < 50))
  );
  function closePosition(equity: number, side: 'long' | 'short', entry: number, px: number): { equity: number; win: boolean } {
    const ret = side === 'long' ? (px - entry) / entry : (entry - px) / entry;
    return { equity: equity * (1 + ret), win: ret > 0 };
  }
  function computeSignalsAtIndex(i: number) {
    const px = closes[i];
    const r = Number.isFinite(rsiAligned[i]) ? rsiAligned[i] : 50;
    const s = Number.isFinite(sma50Aligned[i]) ? sma50Aligned[i] : px;
    const hist = Number.isFinite(macdAligned[i]?.histogram) ? macdAligned[i].histogram : 0;
    const e20 = Number.isFinite(ema20Aligned[i]) ? ema20Aligned[i] : s;
    const e50 = Number.isFinite(ema50Aligned[i]) ? ema50Aligned[i] : s;
    const s200 = Number.isFinite(sma200Aligned[i]) ? sma200Aligned[i] : s;
    const atrPx = Number.isFinite(atrPxAligned[i]) ? atrPxAligned[i] : Math.abs(px - closes[Math.max(0, i - 1)]) * 0.75;
    return { px, r, s, hist, e20, e50, s200, atrPx, buy: shouldBuy(px, s, r, hist, e20, e50, s200), sell: shouldSell(px, s, r, hist, e20, e50, s200) };
  }
  function updateTrailingStop(pos: PositionEx, px: number, atrPx: number, mult: number) {
    if (pos.side === 'long') {
      const trail = px - mult * atrPx;
      pos.sl = Math.max(pos.sl, trail);
    } else {
      const trail = px + mult * atrPx;
      pos.sl = Math.min(pos.sl, trail);
    }
  }
  function tryOppositeExit(pos: PositionEx | null, equity: number, sig: { px: number; buy: boolean; sell: boolean }): { position: PositionEx | null; equity: number; exited: boolean; win: boolean } {
    if (!pos) return { position: pos, equity, exited: false, win: false };
    if (pos.side === 'long' && sig.sell) {
      const res = closePosition(equity, 'long', pos.entry, sig.px);
      return { position: null, equity: res.equity, exited: true, win: res.win };
    }
    if (pos.side === 'short' && sig.buy) {
      const res = closePosition(equity, 'short', pos.entry, sig.px);
      return { position: null, equity: res.equity, exited: true, win: res.win };
    }
    return { position: pos, equity, exited: false, win: false };
  }
  function trySLTPExit(pos: PositionEx | null, equity: number, px: number): { position: PositionEx | null; equity: number; exited: boolean; win: boolean } {
    if (!pos) return { position: pos, equity, exited: false, win: false };
    if (pos.side === 'long' && (px <= pos.sl || px >= pos.tp)) {
      const res = closePosition(equity, 'long', pos.entry, px);
      return { position: null, equity: res.equity, exited: true, win: res.win };
    }
    if (pos.side === 'short' && (px >= pos.sl || px <= pos.tp)) {
      const res = closePosition(equity, 'short', pos.entry, px);
      return { position: null, equity: res.equity, exited: true, win: res.win };
    }
    return { position: pos, equity, exited: false, win: false };
  }
  function processEntryExit(state: { position: PositionEx | null; equity: number; trades: number; wins: number }, sig: { px: number; buy: boolean; sell: boolean; atrPx: number }, riskPct: number, trailMult: number, rrTarget: number, beAt: number, maxBars: number): { position: PositionEx | null; equity: number; trades: number; wins: number } {
    let { position, equity, trades, wins } = state;
    // Entry
    if (!position && sig.buy) { position = { side: 'long', entry: sig.px, sl: sig.px * (1 - riskPct), tp: sig.px * (1 + riskPct * rrTarget), age: 0, be: false, r: sig.px * riskPct }; trades++; return { position, equity, trades, wins }; }
    if (!position && sig.sell) { position = { side: 'short', entry: sig.px, sl: sig.px * (1 + riskPct), tp: sig.px * (1 - riskPct * rrTarget), age: 0, be: false, r: sig.px * riskPct }; trades++; return { position, equity, trades, wins }; }
    if (position) {
      updateTrailingStop(position, sig.px, sig.atrPx, trailMult);
      // Move to breakeven once price moves by beAt * R in our favor
      if (!position.be) {
        if (position.side === 'long' && sig.px - position.entry >= position.r * beAt) { position.sl = Math.max(position.sl, position.entry); position.be = true; }
        if (position.side === 'short' && position.entry - sig.px >= position.r * beAt) { position.sl = Math.min(position.sl, position.entry); position.be = true; }
      }
      const opp = tryOppositeExit(position, equity, sig);
      if (opp.exited) {
        if (opp.win) wins++;
        return { position: opp.position, equity: opp.equity, trades, wins };
      }
      const cut = trySLTPExit(position, equity, sig.px);
      if (cut.exited) {
        if (cut.win) wins++;
        return { position: cut.position, equity: cut.equity, trades, wins };
      }
      // Max bars in trade
      position.age = (position.age ?? 0) + 1;
      if (position.age >= maxBars) {
        const res = closePosition(equity, position.side, position.entry, sig.px);
        if (res.win) wins++;
        return { position: null, equity: res.equity, trades, wins };
      }
    }
    return { position, equity, trades, wins };
  }
  type Position = { side: 'long' | 'short'; entry: number } | null;
  type PositionEx = { side: 'long' | 'short'; entry: number; sl: number; tp: number; age?: number; be?: boolean; r: number };
  let position: PositionEx | null = null;
  let equity = initialCapital;
  const equityCurve: number[] = [];
  let trades = 0, wins = 0;
  const riskPct = isCrypto(pair) ? 0.02 : 0.005; // 2% crypto, 0.5% FX
  const trailMult = Number(process.env.NEXT_PUBLIC_BT_TRAIL_MULT ?? process.env.BT_TRAIL_MULT ?? (isCrypto(pair) ? 3 : 2));
  const rrTarget = Number(process.env.NEXT_PUBLIC_BT_RR ?? process.env.BT_RR ?? (conservative ? 1.0 : 2.0));
  const beAt = Number(process.env.NEXT_PUBLIC_BT_BE_AT ?? process.env.BT_BE_AT ?? 0.5);
  const maxBars = Number(process.env.NEXT_PUBLIC_BT_MAX_BARS ?? process.env.BT_MAX_BARS ?? 120);
  for (let i = offset; i < n; i++) {
    const sig = computeSignalsAtIndex(i);
    const state = processEntryExit({ position, equity, trades, wins }, sig, riskPct, trailMult, rrTarget, beAt, maxBars);
    position = state.position;
    equity = state.equity; trades = state.trades; wins = state.wins;
    equityCurve.push(equity);
  }
  if (position) {
    const px = closes[n - 1];
    const res = closePosition(equity, position.side, position.entry, px);
    if (res.win) wins++;
    equity = res.equity;
    position = null;
  }
  const totalReturnPct = ((equity / initialCapital) - 1) * 100;
  function computeMetrics(curve: number[], start: number): number {
    let peak = start, maxDD = 0;
    for (const e of curve) {
      if (e > peak) peak = e;
      const dd = (peak - e) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    return maxDD * 100;
  }
  const maxDrawdownPct = computeMetrics(equityCurve, initialCapital);
  const winRate = trades ? (wins / trades) * 100 : 0;
  return { pair, timeframe, trades, wins, winRate, totalReturnPct, equityCurve, maxDrawdownPct };
}
