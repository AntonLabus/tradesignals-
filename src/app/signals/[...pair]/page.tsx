import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { calculateSignal, FullSignalResult } from '../../../lib/signals';
import SignalDetailClient from '../../../components/SignalDetailClient';

export async function generateMetadata({ params }: { params: { pair: string[] } }): Promise<Metadata> {
  const [base, quote] = params.pair || [];
  const pair = base && quote ? `${base}/${quote}` : (base || 'Pair');
  return {
    title: `${pair} · Signal Detail · TradeSignals`,
    description: `Detailed trading signal for ${pair}: confidence, levels, and analysis.`,
  };
}

interface SignalDetailPageProps {
  readonly params: { readonly pair: string[] };
  readonly searchParams?: { readonly timeframe?: string };
}

export default async function SignalDetailPage({ params, searchParams }: SignalDetailPageProps) {
  const [base, quote] = params.pair || [];
  if (!base) notFound();
  const pair = quote ? `${decodeURIComponent(base)}/${decodeURIComponent(quote)}` : decodeURIComponent(base);
  if (!pair.includes('/')) notFound();

  const timeframe = searchParams?.timeframe ?? '1H';
  try {
    const signal: FullSignalResult = await calculateSignal(pair, timeframe);
    return <SignalDetailClient signal={signal} />;
  } catch (e) {
    console.error('SignalDetailPage error:', e instanceof Error ? e.message : e);
    // Graceful fallback instead of 404 so users see the page even if a data provider failed
    const fallback: FullSignalResult = {
      pair,
      assetClass: /^(BTC|ETH|SOL|XRP|ADA|DOGE|BNB|LTC|DOT|AVAX|LINK|MATIC|TRX|SHIB|BCH|XLM|NEAR|UNI)\//.test(pair) ? 'Crypto' : 'Forex',
      type: 'Hold',
      confidence: 0,
      timeframe,
      buyLevel: 0,
      stopLoss: 0,
      takeProfit: 0,
      explanation: 'Data temporarily unavailable',
      stale: true,
      news: [],
      indicators: { rsi: 0, sma50: 0, sma200: 0 },
      fundamentals: { score: 0, factors: [] },
    } as FullSignalResult;
    return <SignalDetailClient signal={fallback} />;
  }
}

// Ensure this page is always rendered dynamically (SSR), not statically pre-rendered
export const dynamic = 'force-dynamic';
export const revalidate = 0;
