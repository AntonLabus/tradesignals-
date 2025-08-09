import React from 'react';
import Link from 'next/link';
import SimpleChart from './SimpleChart';

// Type for a trading signal row
interface Signal {
  pair: string;
  assetClass: 'Forex' | 'Crypto';
  type: 'Buy' | 'Sell' | 'Hold'; // removed 'None' to align with SimpleChart props
  confidence: number;
  timeframe: string;
  buyLevel: number;
  stopLoss: number;
  takeProfit: number;
  indicators?: { rsi: number };
  fundamentals?: { score: number };
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
          <th className="px-4 py-2">Fundamental</th>
          <th className="px-4 py-2">Timeframe</th>
          <th className="px-4 py-2">Levels (Buy / SL / TP)</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((signal: Signal) => {
          let barColor = 'bg-red-500';
          if (signal.confidence > 66) {
            barColor = 'bg-green-500';
          } else if (signal.confidence > 33) {
            barColor = 'bg-yellow-500';
          }
          return (
          <tr key={signal.pair} className="block md:table-row">
            <td className="border px-4 py-2">
              <SimpleChart 
                pair={signal.pair}
                signalType={signal.type}
                confidence={signal.confidence}
              />
            </td>
            <td className="border px-4 py-2">
              <Link
                href={`/signals/${encodeURIComponent(signal.pair.split('/')[0])}/${encodeURIComponent(signal.pair.split('/')[1])}`}
                className="text-blue-500 hover:underline"
              >
                {signal.pair}
              </Link>
            </td>
            <td className="border px-4 py-2">{signal.assetClass}</td>
            <td className="border px-4 py-2">{signal.type}</td>
            <td className="border px-4 py-2">
              <div className="w-24 bg-gray-200 h-2 rounded overflow-hidden">
                <div className={`h-full ${barColor}`} style={{ width: `${signal.confidence}%` }} />
              </div>
              <span className="text-xs ml-1">{signal.confidence}%</span>
            </td>
            <td className="border px-4 py-2 text-sm">{signal.fundamentals?.score ?? '—'}</td>
            <td className="border px-4 py-2">{signal.timeframe}</td>
            <td className="border px-4 py-2">
              {signal.buyLevel} / {signal.stopLoss} / {signal.takeProfit}
            </td>
          </tr>
        );})}
      </tbody>
    </table>
  );
};

export default SignalsTable;