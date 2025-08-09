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
    notFound();
  }
}

// Ensure this page is always rendered dynamically (SSR), not statically pre-rendered
export const dynamic = 'force-dynamic';
export const revalidate = 0;
