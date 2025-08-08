import { NextResponse } from 'next/server';
import { calculateSignal } from '../../../lib/signals';

// Simple in-memory cache with TTL to reduce external calls
const cache: Record<string, { ts: number; data: any }> = {};
const TTL = 1000 * 60; // 1 minute per pair/timeframe

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pairsParam = searchParams.get('pairs') || 'EUR/USD,USD/JPY,GBP/USD,BTC/USD,ETH/USD';
  const timeframe = searchParams.get('timeframe') || '1H';
  const pairs = pairsParam.split(',').map(p => p.trim()).filter(Boolean);

  const results: any[] = [];
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
      results.push({ pair, assetClass: /USD/.test(pair) ? 'Forex' : 'Crypto', type: 'Hold', confidence: 0, timeframe, buyLevel: 0, stopLoss: 0, takeProfit: 0, explanation: 'Error', news: [], indicators: { rsi: 0, sma50: 0, sma200: 0 }, fundamentals: { score: 0, factors: [] } });
    }
  }
  return NextResponse.json({ signals: results });
}
