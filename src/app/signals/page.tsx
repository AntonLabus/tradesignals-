import SignalsTable from './SignalsTable';
import TimeframeSelectorClient from '../../components/TimeframeSelectorClient';
import { Metadata } from 'next';
import { calculateSignal, FullSignalResult } from '../../lib/signals';

export const metadata: Metadata = {
  title: 'Signals · TradeSignals',
  description: 'Current active trading signals for Forex and Crypto pairs',
};

// Replace mock data with live fetch logic
interface SignalsPageProps {
  readonly searchParams?: Promise<{ readonly timeframe?: string }>;
}
export default async function SignalsPage({ searchParams }: SignalsPageProps) {
  const pairs = ['EUR/USD', 'USD/JPY', 'GBP/USD', 'BTC/USD', 'ETH/USD'];
  const resolvedSearchParams = await searchParams;
  const timeframe = resolvedSearchParams?.timeframe ?? '1H';
  // Sequential to reduce upstream rate spikes
  const signals: FullSignalResult[] = [];
  for (const pair of pairs) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const sig = await calculateSignal(pair, timeframe);
      signals.push(sig);
    } catch {
      signals.push({
        pair,
        assetClass: /USD/.test(pair) ? 'Forex' : 'Crypto',
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

  return (
    <div className="space-y-6">
      {/* Client-side timeframe selector */}
      <TimeframeSelectorClient />
      <h1 className="text-3xl font-bold">Active Signals</h1>
      <SignalsTable signals={signals} />
    </div>
  );
}
