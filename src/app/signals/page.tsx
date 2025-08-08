import SignalsTable from './SignalsTable';
import TimeframeSelectorClient from '../../components/TimeframeSelectorClient';
import SignalsSidebar from '../../components/SignalsSidebar';
import { Metadata } from 'next';
import React, { useMemo, useState } from 'react';
import type { FullSignalResult } from '../../lib/signals';

export const metadata: Metadata = {
  title: 'Signals · TradeSignals',
  description: 'Current active trading signals for Forex and Crypto pairs',
};

export const dynamic = 'force-dynamic';

// Client fetch version
export default function SignalsPage() {
  // Use client hooks in child components; keep page as simple container.
  return (
    <div className="space-y-6">
      <TimeframeSelectorClient />
      <h1 className="text-3xl font-bold tracking-tight">Active Signals</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-6">
        {/* Sidebar + Table compose in a client wrapper */}
        <ClientLayout />
      </div>
    </div>
  );
}

function ClientLayout() {
  const [allSignals, setAllSignals] = useState<FullSignalResult[]>([]);
  const [assetFilter, setAssetFilter] = useState<'All' | 'Forex' | 'Crypto'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Buy' | 'Sell' | 'Hold'>('All');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('All');
  const timeframes = useMemo(() => Array.from(new Set(allSignals.map(s => s.timeframe))), [allSignals]);

  return (
    <>
      <SignalsSidebar
        signals={allSignals}
        filters={{ assetFilter, setAssetFilter, typeFilter, setTypeFilter, timeframeFilter, setTimeframeFilter, timeframes }}
      />
      <div className="glass p-2">
        <SignalsTable
          signals={[]}
          showInlineFilters={false}
          externalFilters={{ assetFilter, setAssetFilter, typeFilter, setTypeFilter, timeframeFilter, setTimeframeFilter }}
          onSignalsUpdate={setAllSignals}
        />
      </div>
    </>
  );
}
