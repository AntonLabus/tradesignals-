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
  // Offer a full set of timeframes in the Dashboard regardless of currently loaded data
  const timeframes = useMemo(() => ['1m', '5m', '15m', '30m', '1H', '4H', '1D'], []);

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
