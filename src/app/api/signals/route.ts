import { NextResponse } from 'next/server';
import { calculateSignal, FullSignalResult } from '../../../lib/signals';
import { getDefaultTimeframe, sanitizeTimeframe } from '../../../lib/timeframes';

// Simple in-memory cache with TTL to reduce external calls
const cache: Record<string, { ts: number; data: FullSignalResult }> = {};
// Dynamic TTL by timeframe: shorter for intraday, longer for daily
function getTTL(tf: string) {
  if (tf === '1D') return 10 * 60 * 1000; // 10 min
  if (tf === '4H') return 3 * 60 * 1000;  // 3 min
  return 60 * 1000;                       // 1m..1H => 1 min
}

// Central default pairs list (Forex majors/minors + popular cryptos)
const DEFAULT_PAIRS = [
  // Forex majors
  'EUR/USD','USD/JPY','GBP/USD','USD/CHF','AUD/USD','USD/CAD','NZD/USD',
  // Major crosses
  'EUR/JPY','GBP/JPY','EUR/GBP','AUD/JPY','EUR/AUD',
  // Popular cryptos (vs USD)
  'BTC/USD','ETH/USD','SOL/USD','XRP/USD','ADA/USD','DOGE/USD','BNB/USD','LTC/USD','DOT/USD','AVAX/USD','LINK/USD','MATIC/USD','TRX/USD','SHIB/USD','BCH/USD','XLM/USD','NEAR/USD','UNI/USD'
];

const CRYPTO_BASES = /^(BTC|ETH|SOL|XRP|ADA|DOGE|BNB|LTC|DOT|AVAX|LINK|MATIC|TRX|SHIB|BCH|XLM|NEAR|UNI)$/;
// Tune batching/timeout to avoid initial cold-start fallbacks that show zeros
const BATCH_SIZE = 3; // lower concurrency to reduce provider throttling further
const PER_SIGNAL_TIMEOUT = 9000; // allow calc + two HTTP fallback paths
const GLOBAL_BUDGET = 30000; // more time for a few batches to complete

async function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    const to = setTimeout(() => resolve(onTimeout()), ms);
    p.then(v => { clearTimeout(to); resolve(v); }).catch(() => { clearTimeout(to); resolve(onTimeout()); });
  });
}

function fallbackSignal(pair: string, timeframe: string, reason: string, prior?: FullSignalResult): FullSignalResult {
  const base = pair.split('/')[0].toUpperCase();
  const assetClass: 'Forex' | 'Crypto' = CRYPTO_BASES.test(base) ? 'Crypto' : 'Forex';
  return {
    pair,
    assetClass,
    type: 'Hold',
    confidence: 0,
    timeframe,
  buyLevel: prior?.buyLevel ?? 0,
  stopLoss: prior?.stopLoss ?? 0,
  takeProfit: prior?.takeProfit ?? 0,
  explanation: prior?.explanation ? `${prior.explanation} | ${reason}` : reason,
  stale: true,
  news: prior?.news ?? [],
  indicators: prior?.indicators ?? { rsi: 0, sma50: 0, sma200: 0 },
  fundamentals: prior?.fundamentals ?? { score: 0, factors: [] },
  };
}

export async function GET(req: Request) {
  const start = Date.now();
  const { searchParams } = new URL(req.url);
  const pairsParam = searchParams.get('pairs') || DEFAULT_PAIRS.join(',');
  const timeframe = sanitizeTimeframe(searchParams.get('timeframe'), getDefaultTimeframe());
  const pairs = pairsParam.split(',').map(p => p.trim()).filter(Boolean);

  const results: FullSignalResult[] = [];

  // Lightweight prewarm: on first request without explicit pairs, try to load top 6 pairs into cache.
  // This runs only if cache is cold for those keys and within budget.
  if (!searchParams.get('pairs')) {
    const warmPairs = DEFAULT_PAIRS.slice(0, 6);
    await Promise.all(warmPairs.map(async (pair) => {
      const key = pair + ':' + timeframe;
      if (cache[key]) return; // already present
      if (Date.now() - start > GLOBAL_BUDGET / 2) return; // keep budget
      try {
        const sig = await withTimeout(calculateSignal(pair, timeframe), PER_SIGNAL_TIMEOUT, () => fallbackSignal(pair, timeframe, 'Warm Timeout'));
        if (!(sig.confidence === 0 && sig.type === 'Hold' && /^(Timeout|Skipped|Warm)/.test(sig.explanation))) {
          cache[key] = { ts: Date.now(), data: sig };
        }
      } catch {
        // ignore
      }
    }));
  }

  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    if (Date.now() - start > GLOBAL_BUDGET) {
      // Budget exhausted, append fallbacks for remaining pairs
      for (let j = i; j < pairs.length; j++) {
        results.push(fallbackSignal(pairs[j], timeframe, 'Skipped (time budget)'));
      }
      break;
    }
    const batch = pairs.slice(i, i + BATCH_SIZE);
    // Prepare promises for batch
    const promises = batch.map(async (pair) => {
      const key = pair + ':' + timeframe;
      const now = Date.now();
      const cached = cache[key];
      const TTL = getTTL(timeframe);
      if (cached && now - cached.ts < TTL) return cached.data; // fresh
      if (Date.now() - start > GLOBAL_BUDGET) {
        return fallbackSignal(pair, timeframe, 'Skipped (time budget)', cached?.data);
      }
      const calc = withTimeout(
        calculateSignal(pair, timeframe),
        PER_SIGNAL_TIMEOUT,
        () => {
          // On timeout, serve soft-stale cache if available instead of zeroed fallback
          if (cached) return { ...cached.data, stale: true } as FullSignalResult;
          return fallbackSignal(pair, timeframe, 'Timeout');
        }
      );
      try {
        const sig = await calc; // already timeout-wrapped
        // Identify fallback by zero confidence+Hold+explanation starting with Timeout/Skipped
        if (!(sig.confidence === 0 && sig.type === 'Hold' && /^(Timeout|Skipped)/.test(sig.explanation))) {
          cache[key] = { ts: now, data: sig };
        }
        return sig;
      } catch (e) {
  const err = e instanceof Error ? e.message : String(e);
  return fallbackSignal(pair, timeframe, `Error: ${err.slice(0, 60)}`, cached?.data);
      }
    });
    // eslint-disable-next-line no-await-in-loop
    const settled = await Promise.all(promises);
    results.push(...settled);
  }

  const debug = searchParams.get('debug') === '1';
  const meta: any = { processed: results.length, elapsedMs: Date.now() - start };
  if (debug) {
    meta.sources = results.map(r => ({ pair: r.pair, src: (r as any).debugSource })).slice(0, 50);
  }
  return NextResponse.json({ signals: results, meta });
}
