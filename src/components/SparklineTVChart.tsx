"use client";
import dynamic from 'next/dynamic';
import React, { useState, useEffect } from 'react';

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

// Dynamically import TradingViewWidget with no SSR
const TradingViewWidget = dynamic<TradingViewWidgetProps>(
  () => import('react-tradingview-widget').then((mod) => mod.default),
  { 
    ssr: false,
    loading: () => (
      <div className="w-[120px] h-[60px] bg-gray-100 animate-pulse flex items-center justify-center text-xs">
        Loading...
      </div>
    )
  }
);

export default function SparklineTVChart({ pair, timeframe }: SparklineTVChartProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Don't render anything on server-side or until mounted
  if (!isMounted) {
    return (
      <div className="w-[120px] h-[60px] bg-gray-100 flex items-center justify-center text-xs">
        Chart
      </div>
    );
  }

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
