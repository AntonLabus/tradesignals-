import SignalsTable from './SignalsTable';
import TimeframeSelectorClient from '../../components/TimeframeSelectorClient';
import { Metadata } from 'next';
import { calculateSignal } from '../../lib/signals';

type Signal = {
  pair: string;
  assetClass: 'Forex' | 'Crypto';
  type: 'Buy' | 'Sell' | 'Hold';
  confidence: number;
  timeframe: string;
  buyLevel: number;
  stopLoss: number;
  takeProfit: number;
};

export const metadata: Metadata = {
  title: 'Signals · TradeSignals',
  description: 'Current active trading signals for Forex and Crypto pairs',
};

// Replace mock data with live fetch logic
interface SignalsPageProps {
  readonly searchParams?: Promise<{ readonly timeframe?: string }>;
}
export default async function SignalsPage({ searchParams }: SignalsPageProps) {
  // Define the pairs to display
  const pairs = ['EUR/USD', 'USD/JPY', 'BTC/USD', 'ETH/USD'];

  // Determine timeframe from URL (default to 1H)
  const resolvedSearchParams = await searchParams;
  const timeframe = resolvedSearchParams?.timeframe ?? '1H';
  // Calculate signals using full trading rules engine
  const signals = await Promise.all(
    pairs.map(pair => calculateSignal(pair, timeframe))
  );

  return (
    <div className="space-y-6">
      {/* Client-side timeframe selector */}
      <TimeframeSelectorClient />
      <h1 className="text-3xl font-bold">Active Signals</h1>
      <SignalsTable signals={signals} />
    </div>
  );
}
