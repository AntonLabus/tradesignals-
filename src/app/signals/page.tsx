import SignalsTable from './SignalsTable';
import TimeframeSelectorClient from '../../components/TimeframeSelectorClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Signals · TradeSignals',
  description: 'Current active trading signals for Forex and Crypto pairs',
};

export const dynamic = 'force-dynamic';

// Client fetch version
export default async function SignalsPage() {
  return (
    <div className="space-y-6">
      <TimeframeSelectorClient />
      <h1 className="text-3xl font-bold">Active Signals</h1>
      <SignalsTable signals={[]} />
    </div>
  );
}
