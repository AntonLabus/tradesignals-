import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { calculateSignal, FullSignalResult } from '../../../lib/signals';
import { getDefaultTimeframe, sanitizeTimeframe } from '../../../lib/timeframes';
import SignalDetailClient from '../../../components/SignalDetailClient';

export async function generateMetadata({ params }: { params: { pair: string } }): Promise<Metadata> {
  const { pair } = params;
  return {
    title: `${pair} · Signal Detail · TradeSignals`,
    description: `Detailed trading signal for ${pair}: confidence, levels, and analysis.`,
  };
}

interface SignalDetailPageProps {
  readonly params: { readonly pair: string };
  readonly searchParams?: { readonly timeframe?: string };
}

export default async function SignalDetailPage({ params, searchParams }: SignalDetailPageProps) {
  const pair = decodeURIComponent(params.pair);
  if (!pair) notFound();

  const timeframe = sanitizeTimeframe(searchParams?.timeframe, getDefaultTimeframe());
  try {
    const signal: FullSignalResult = await calculateSignal(pair, timeframe);
    return <SignalDetailClient signal={signal} />;
  } catch (e) {
    console.error('SignalDetailPage error:', e instanceof Error ? e.message : e);
    notFound();
  }
}
