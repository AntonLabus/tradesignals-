"use client";
import React, { useState } from 'react';
import Link from 'next/link';

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

interface SignalsTableProps {
  readonly signals: Signal[];
}

export default function SignalsTable({ signals }: SignalsTableProps) {
  const [assetFilter, setAssetFilter] = useState<'All' | 'Forex' | 'Crypto'>('All');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Buy' | 'Sell' | 'Hold'>('All');
  const timeframes = Array.from(new Set(signals.map((s) => s.timeframe)));
  const [timeframeFilter, setTimeframeFilter] = useState<string>('All');

  const filtered = signals.filter(
    (s) =>
      (assetFilter === 'All' || s.assetClass === assetFilter) &&
      (typeFilter === 'All' || s.type === typeFilter) &&
      (timeframeFilter === 'All' || s.timeframe === timeframeFilter)
  );

  return (
    <div className="space-y-4">
      <div className="flex space-x-4 mb-4">
        <div>
          <label htmlFor="assetClassSelect" className="block font-medium">Asset Class</label>
          <select
            id="assetClassSelect"
            className="border rounded p-1"
            value={assetFilter}
            onChange={(e) => setAssetFilter(e.target.value as any)}
          >
            <option value="All">All</option>
            <option value="Forex">Forex</option>
            <option value="Crypto">Crypto</option>
          </select>
        </div>
        <div>
          <label htmlFor="typeSelect" className="block font-medium">Type</label>
          <select
            id="typeSelect"
            className="border rounded p-1"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
          >
            <option value="All">All</option>
            <option value="Buy">Buy</option>
            <option value="Sell">Sell</option>
            <option value="Hold">Hold</option>
          </select>
        </div>
        <div>
          <label htmlFor="timeframeSelect" className="block font-medium">Timeframe</label>
          <select
            id="timeframeSelect"
            className="border rounded p-1"
            value={timeframeFilter}
            onChange={(e) => setTimeframeFilter(e.target.value)}
          >
            <option value="All">All</option>
            {timeframes.map((tf) => (
              <option key={tf} value={tf}>
                {tf}
              </option>
            ))}
          </select>
        </div>
      </div>
      <table className="min-w-full table-auto bg-white dark:bg-gray-800">
        <thead>
          <tr>
            <th className="px-4 py-2">Pair</th>
            <th className="px-4 py-2">Asset Class</th>
            <th className="px-4 py-2">Type</th>
            <th className="px-4 py-2">Confidence</th>
            <th className="px-4 py-2">Timeframe</th>
            <th className="px-4 py-2">Levels (Buy / SL / TP)</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((signal) => {
            let typeClass = 'text-gray-600';
            if (signal.type === 'Buy') typeClass = 'text-green-600';
            else if (signal.type === 'Sell') typeClass = 'text-red-600';
            return (
              <tr key={signal.pair} className="hover:bg-gray-100 dark:hover:bg-gray-700">
                <td className="border px-4 py-2">
                  <Link
                    href={`/signals/${encodeURIComponent(signal.pair)}`}
                    className="text-blue-500 hover:underline"
                  >
                    {signal.pair}
                  </Link>
                </td>
                <td className="border px-4 py-2">{signal.assetClass}</td>
                <td className={`border px-4 py-2 font-semibold ${typeClass}`}>
                  {signal.type}
                </td>
                <td className="border px-4 py-2">{signal.confidence}%</td>
                <td className="border px-4 py-2">{signal.timeframe}</td>
                <td className="border px-4 py-2">
                  {signal.buyLevel} / {signal.stopLoss} / {signal.takeProfit}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
