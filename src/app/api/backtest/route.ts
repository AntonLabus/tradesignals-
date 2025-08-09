import { NextRequest, NextResponse } from 'next/server';
import { runTechnicalBacktest } from '../../../lib/backtest';
import { getDefaultTimeframe, sanitizeTimeframe } from '../../../lib/timeframes';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pair = searchParams.get('pair') || 'EUR/USD';
  const timeframe = sanitizeTimeframe(searchParams.get('timeframe'), getDefaultTimeframe());
  try {
    const result = await runTechnicalBacktest(pair, timeframe);
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Backtest failed' }, { status: 500 });
  }
}
