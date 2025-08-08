"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import SimpleChart from '../../components/SimpleChart';
import type { FullSignalResult } from '../../lib/signals';

// Narrow subset type (reuse interface)
interface SignalsTableProps { readonly signals: FullSignalResult[]; }

function badgeColor(type: string) {
  if (type === 'Buy') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (type === 'Sell') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}
function riskColor(risk?: string) {
  switch (risk) {
    case 'Low': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'Medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'High': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
    default: return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

export default function SignalsTable({ signals: initial }: SignalsTableProps) {
  const [signals, setSignals] = useState<FullSignalResult[]>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetFilter, setAssetFilter] = useState<'All' | 'Forex' | 'Crypto'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Buy' | 'Sell' | 'Hold'>('All');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('All');

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/signals`);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const json = await res.json();
        if (!aborted) setSignals(json.signals);
      } catch (e: any) {
        if (!aborted) setError(e.message || 'Failed');
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, []);

  const timeframes = Array.from(new Set(signals.map((s) => s.timeframe)));
  const filtered = signals.filter(
    (s) =>
      (assetFilter === 'All' || s.assetClass === assetFilter) &&
      (typeFilter === 'All' || s.type === typeFilter) &&
      (timeframeFilter === 'All' || s.timeframe === timeframeFilter)
  );

  if (loading) return <div className="p-4 text-sm text-gray-600 dark:text-gray-300">Loading signals...</div>;
  if (error) return <div className="p-4 text-sm text-red-600">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label htmlFor="assetFilter" className="block text-sm font-medium">Asset Class</label>
          <select id="assetFilter" className="border rounded p-1 bg-white dark:bg-gray-800" value={assetFilter} onChange={(e) => setAssetFilter(e.target.value as any)}>
            <option value="All">All</option>
            <option value="Forex">Forex</option>
            <option value="Crypto">Crypto</option>
          </select>
        </div>
        <div>
          <label htmlFor="typeFilter" className="block text-sm font-medium">Type</label>
          <select id="typeFilter" className="border rounded p-1 bg-white dark:bg-gray-800" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
            <option value="All">All</option>
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
            <option value="Hold">Hold</option>
          </select>
        </div>
        <div>
          <label htmlFor="timeframeFilter" className="block text-sm font-medium">Timeframe</label>
          <select id="timeframeFilter" className="border rounded p-1 bg-white dark:bg-gray-800" value={timeframeFilter} onChange={(e) => setTimeframeFilter(e.target.value)}>
            <option value="All">All</option>
            {timeframes.map((tf) => (<option key={tf} value={tf}>{tf}</option>))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto bg-white dark:bg-gray-800 text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-2">Chart</th>
              <th className="px-4 py-2">Pair</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Confidence</th>
              <th className="px-4 py-2">Tech</th>
              <th className="px-4 py-2">Fund</th>
              <th className="px-4 py-2">Risk</th>
              <th className="px-4 py-2">Vol%</th>
              <th className="px-4 py-2">R/R</th>
              <th className="px-4 py-2">Timeframe</th>
              <th className="px-4 py-2">Levels</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(sig => {
              let confColor: string;
              if (sig.confidence > 70) confColor = 'bg-green-500';
              else if (sig.confidence > 40) confColor = 'bg-amber-500';
              else confColor = 'bg-red-500';
              return (
                <tr key={sig.pair+sig.timeframe} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  <td className="px-4 py-2">
                    <SimpleChart pair={sig.pair} signalType={sig.type} confidence={sig.confidence} history={sig.history} />
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <Link href={`/signals/${encodeURIComponent(sig.pair)}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                      {sig.pair}
                    </Link>
                    <div className="text-[10px] text-gray-500">{sig.assetClass}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold inline-block ${badgeColor(sig.type)}`}>{sig.type}</span>
                  </td>
                  <td className="px-4 py-2 w-32">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded overflow-hidden" title={`${sig.confidence}%`}>
                      <div className={`h-full ${confColor}`} style={{ width: `${sig.confidence}%` }} />
                    </div>
                    <div className="text-[10px] mt-1 text-gray-600 dark:text-gray-400 text-right">{sig.confidence}%</div>
                  </td>
                  <td className="px-4 py-2 text-center">{sig.technicalScore ?? '—'}</td>
                  <td className="px-4 py-2 text-center">{sig.fundamentals?.score ?? sig.fundamentalScore ?? '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold inline-block ${riskColor(sig.riskCategory)}`}>{sig.riskCategory ?? '—'}</span>
                  </td>
                  <td className="px-4 py-2 text-center">{sig.volatilityPct?.toFixed?.(2) ?? '—'}</td>
                  <td className="px-4 py-2 text-center">{sig.riskReward?.toFixed?.(2) ?? '—'}</td>
                  <td className="px-4 py-2 text-center">{sig.timeframe}</td>
                  <td className="px-4 py-2 text-[11px]">
                    <div><span className="font-semibold">B</span> {sig.buyLevel}</div>
                    <div><span className="font-semibold text-rose-600">SL</span> {sig.stopLoss}</div>
                    <div><span className="font-semibold text-green-600">TP</span> {sig.takeProfit}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
