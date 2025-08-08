import { NextResponse } from 'next/server';
import { calculateSignal, FullSignalResult } from '../../../lib/signals';

// Simple in-memory cache with TTL to reduce external calls
const cache: Record<string, { ts: number; data: FullSignalResult }> = {};
const TTL = 1000 * 60; // 1 minute per pair/timeframe

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pairsParam = searchParams.get('pairs') || 'EUR/USD,USD/JPY,GBP/USD,BTC/USD,ETH/USD';
  const timeframe = searchParams.get('timeframe') || '1H';
  const pairs = pairsParam.split(',').map(p => p.trim()).filter(Boolean);

  const results: FullSignalResult[] = [];
  for (const pair of pairs) {
    const key = pair + ':' + timeframe;
    const now = Date.now();
    if (cache[key] && now - cache[key].ts < TTL) {
      results.push(cache[key].data);
      continue;
    }
    try {
      // eslint-disable-next-line no-await-in-loop
      const sig = await calculateSignal(pair, timeframe);
      cache[key] = { ts: now, data: sig };
      results.push(sig);
    } catch (e) {
      // Explicitly determine asset class with literal typing
      const base = pair.split('/')[0].toUpperCase();
      const assetClass: 'Forex' | 'Crypto' = /^(BTC|ETH)$/.test(base) ? 'Crypto' : 'Forex';
      results.push({
        pair,
        assetClass,
        type: 'Hold',
        confidence: 0,
        timeframe,
        buyLevel: 0,
        stopLoss: 0,
        takeProfit: 0,
        explanation: 'Error',
        news: [],
        indicators: { rsi: 0, sma50: 0, sma200: 0 },
        fundamentals: { score: 0, factors: [] },
      });
    }
  }
  return NextResponse.json({ signals: results });
}
