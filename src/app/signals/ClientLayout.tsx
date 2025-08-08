"use client";
import React, { useMemo, useState } from 'react';
import SignalsSidebar from '../../components/SignalsSidebar';
import SignalsTable from './SignalsTable';
import type { FullSignalResult } from '../../lib/signals';

// Local type aliases for filters
type AssetFilter = 'All' | 'Forex' | 'Crypto';
type SignalTypeFilter = 'All' | 'Buy' | 'Sell' | 'Hold';

export default function ClientLayout() {
  const [allSignals, setAllSignals] = useState<FullSignalResult[]>([]);
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('All');
  const [typeFilter, setTypeFilter] = useState<SignalTypeFilter>('All');
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
