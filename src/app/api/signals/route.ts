import { NextResponse } from 'next/server';
import { calculateSignal, FullSignalResult } from '../../../lib/signals';

// Simple in-memory cache with TTL to reduce external calls
const cache: Record<string, { ts: number; data: FullSignalResult }> = {};
const TTL = 1000 * 60; // 1 minute per pair/timeframe

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
const BATCH_SIZE = 6; // number of pairs processed concurrently
const PER_SIGNAL_TIMEOUT = 2500; // ms per signal calc
const GLOBAL_BUDGET = 8000; // ms total budget for request

async function withTimeout<T>(p: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    const to = setTimeout(() => resolve(onTimeout()), ms);
    p.then(v => { clearTimeout(to); resolve(v); }).catch(() => { clearTimeout(to); resolve(onTimeout()); });
  });
}

function fallbackSignal(pair: string, timeframe: string, reason: string): FullSignalResult {
  const base = pair.split('/')[0].toUpperCase();
  const assetClass: 'Forex' | 'Crypto' = CRYPTO_BASES.test(base) ? 'Crypto' : 'Forex';
  return {
    pair,
    assetClass,
    type: 'Hold',
    confidence: 0,
    timeframe,
    buyLevel: 0,
    stopLoss: 0,
    takeProfit: 0,
    explanation: reason,
    news: [],
    indicators: { rsi: 0, sma50: 0, sma200: 0 },
    fundamentals: { score: 0, factors: [] },
  };
}

export async function GET(req: Request) {
  const start = Date.now();
  const { searchParams } = new URL(req.url);
  const pairsParam = searchParams.get('pairs') || DEFAULT_PAIRS.join(',');
  const timeframe = searchParams.get('timeframe') || '1H';
  const pairs = pairsParam.split(',').map(p => p.trim()).filter(Boolean);

  const results: FullSignalResult[] = [];

  outer: for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    if (Date.now() - start > GLOBAL_BUDGET) {
      // Budget exhausted, append fallbacks for remaining pairs
      for (let j = i; j < pairs.length; j++) {
        results.push(fallbackSignal(pairs[j], timeframe, 'Skipped (time budget)'));
      }
      break outer;
    }
    const batch = pairs.slice(i, i + BATCH_SIZE);
    // Prepare promises for batch
    const promises = batch.map(async (pair) => {
      const key = pair + ':' + timeframe;
      const now = Date.now();
      if (cache[key] && now - cache[key].ts < TTL) {
        return cache[key].data;
      }
      if (Date.now() - start > GLOBAL_BUDGET) {
        return fallbackSignal(pair, timeframe, 'Skipped (time budget)');
      }
      const calc = withTimeout(
        calculateSignal(pair, timeframe),
        PER_SIGNAL_TIMEOUT,
        () => fallbackSignal(pair, timeframe, 'Timeout')
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
        return fallbackSignal(pair, timeframe, `Error: ${err.slice(0, 60)}`);
      }
    });
    // eslint-disable-next-line no-await-in-loop
    const settled = await Promise.all(promises);
    results.push(...settled);
  }

  return NextResponse.json({ signals: results, meta: { processed: results.length, elapsedMs: Date.now() - start } });
}
