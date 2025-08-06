import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { calculateSignal } from '../../../lib/signals';
import SignalDetailClient from '../../../components/SignalDetailClient';

export async function generateMetadata({ params }: { 
  params: Promise<{ pair: string }>; 
}): Promise<Metadata> {
  const resolvedParams = await params;
  const { pair } = resolvedParams;
  return {
    title: `${pair} · Signal Detail · TradeSignals`,
    description: `Detailed trading signal for ${pair}: confidence, levels, and analysis.`,
  };
}

export default async function SignalDetailPage({ params, searchParams }: { 
  params: Promise<{ pair: string }>; 
  searchParams?: Promise<{ timeframe?: string }>; 
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const pair = decodeURIComponent(resolvedParams.pair);
  if (!pair) notFound();

  // Determine timeframe, default to 1H
  const timeframe = resolvedSearchParams?.timeframe || '1H';
  // Calculate full signal with explanation & news
  const signal = await calculateSignal(pair, timeframe);

  // Render client-side signal detail
  return <SignalDetailClient signal={signal} />;
}
