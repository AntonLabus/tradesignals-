"use client";
import dynamic from 'next/dynamic';
import React from 'react';
// Dynamically import TradingViewWidget for client-side only
const TradingViewWidget: React.ComponentType<TradingViewWidgetProps> = dynamic<TradingViewWidgetProps>(
  () => import('react-tradingview-widget').then((mod) => mod.default),
  { ssr: false }
);

// Define props for TradingViewWidget
interface TradingViewWidgetProps {
  readonly symbol: string;
  readonly autosize?: boolean;
  readonly width?: number;
  readonly height?: number;
  readonly interval?: string;
  readonly theme?: string;
}

interface SparklineTVChartProps {
  readonly pair: string;
  readonly timeframe: string;
}

export default function SparklineTVChart({ pair, timeframe }: SparklineTVChartProps) {
  // TradingView symbol expects no slash, e.g. 'EURUSD', 'BTCUSD'
  const symbol = pair.replace('/', '');
  return (
    <div style={{ width: 120, height: 60 }}>
      <TradingViewWidget
        symbol={symbol}
        autosize={false}
        width={120}
        height={60}
        interval={timeframe}
        theme="dark"
      />
    </div>
  );
}
