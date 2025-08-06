import React from 'react';
import Link from 'next/link';
import SparklineTVChart from './SparklineTVChart';

// Type for a trading signal row
interface Signal {
  pair: string;
  assetClass: 'Forex' | 'Crypto';
  type: 'Buy' | 'Sell' | 'Hold';
  confidence: number;
  timeframe: string;
  buyLevel: number;
  stopLoss: number;
  takeProfit: number;
}

interface SignalsTableProps {
  filtered: Signal[];
}

const SignalsTable = ({ filtered }: SignalsTableProps) => {
  return (
    <table className="min-w-full border-collapse block md:table">
        <thead>
        <tr className="block md:table-row">
            <th className="px-4 py-2">Chart</th>
          <th className="px-4 py-2">Pair</th>
          <th className="px-4 py-2">Asset Class</th>
          <th className="px-4 py-2">Type</th>
          <th className="px-4 py-2">Confidence</th>
          <th className="px-4 py-2">Timeframe</th>
          <th className="px-4 py-2">Levels (Buy / SL / TP)</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((signal: Signal) => (
          <tr key={signal.pair} className="block md:table-row">
            <td className="border px-4 py-2">
              {/* Temporarily use placeholder until hydration issue is fully resolved */}
              <div className="w-[120px] h-[60px] bg-gradient-to-r from-blue-100 to-green-100 flex items-center justify-center text-xs font-medium rounded">
                📈 Chart
              </div>
            </td>
            <td className="border px-4 py-2">
              <Link
                href={`/signals/${encodeURIComponent(signal.pair)}`}
                className="text-blue-500 hover:underline"
              >
                {signal.pair}
              </Link>
            </td>
            <td className="border px-4 py-2">{signal.assetClass}</td>
            <td className="border px-4 py-2">{signal.type}</td>
            <td className="border px-4 py-2">{signal.confidence}</td>
            <td className="border px-4 py-2">{signal.timeframe}</td>
            <td className="border px-4 py-2">
              {signal.buyLevel} / {signal.stopLoss} / {signal.takeProfit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default SignalsTable;