import SignalsTable from './SignalsTable';
import { Metadata } from 'next';

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

const mockSignals: Signal[] = [
  { pair: 'EUR/USD', assetClass: 'Forex', type: 'Buy', confidence: 82, timeframe: '1H', buyLevel: 1.12, stopLoss: 1.1, takeProfit: 1.15 },
  { pair: 'BTC/USD', assetClass: 'Crypto', type: 'Sell', confidence: 74, timeframe: '4H', buyLevel: 30000, stopLoss: 31000, takeProfit: 28000 },
  { pair: 'USD/JPY', assetClass: 'Forex', type: 'Hold', confidence: 65, timeframe: '15m', buyLevel: 109.5, stopLoss: 109.0, takeProfit: 110.0 },
];

export default function SignalsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Active Signals</h1>
      {/* Render the filtered signals table */}
      <SignalsTable signals={mockSignals} />
    </div>
  );
}
