"use client";
import React, { useState } from 'react';
import TradingViewWidget from 'react-tradingview-widget';
import TimeframeSelector from './TimeframeSelector';

export interface NewsItem { title: string; url: string; }
export interface SignalData {
  pair: string;
  assetClass: string;
  type: 'Buy' | 'Sell' | 'Hold';
  confidence: number;
  timeframe: string;
  buyLevel: number;
  stopLoss: number;
  takeProfit: number;
  explanation: string;
  news: NewsItem[];
}

interface Props { signal: SignalData; }

export default function SignalDetailClient({ signal }: Props) {
  const [timeframe, setTimeframe] = useState(signal.timeframe);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Signal for {signal.pair}</h1>

      <TimeframeSelector onChange={setTimeframe} />

      <div className="h-64">
        <TradingViewWidget
          symbol={signal.pair.replace('/', '')}
          autosize
          theme="dark"
          interval={timeframe}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold">Signal Data</h2>
          <ul className="mt-2 space-y-1">
            <li>
              Type: <span className={`${signal.type === 'Buy' ? 'text-green-600' : 'text-red-600'} font-semibold`}>{signal.type}</span>
            </li>
            <li>Confidence: {signal.confidence}%</li>
            <li>Timeframe: {timeframe}</li>
            <li>Buy Level: {signal.buyLevel}</li>
            <li>Stop Loss: {signal.stopLoss}</li>
            <li>Take Profit: {signal.takeProfit}</li>
          </ul>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold">Analysis & News</h2>
          <p className="mt-2">{signal.explanation}</p>
          <h3 className="mt-4 font-semibold">Related News</h3>
          <ul className="list-disc list-inside mt-2 space-y-1">
            {signal.news.map((item) => (
              <li key={item.url}>
                <a href={item.url} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
