"use client";
import dynamic from 'next/dynamic';
import React from 'react';
import { useIsClient } from '../hooks/useIsClient';

interface SparklineTVChartProps {
  readonly pair: string;
  readonly timeframe: string;
}

// Create a completely client-side only TradingView component
const ClientOnlyTradingView = dynamic(
  () => {
    return import('react-tradingview-widget').then((mod) => {
      const TradingViewWidget = mod.default;
      
      return function TradingViewChart({ symbol, timeframe }: { symbol: string; timeframe: string }) {
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
      };
    });
  },
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
  const isClient = useIsClient();

  // Always return the same structure to prevent hydration mismatch
  if (!isClient) {
    return (
      <div className="w-[120px] h-[60px] bg-gray-100 flex items-center justify-center text-xs">
        Chart
      </div>
    );
  }

  // TradingView symbol expects no slash, e.g. 'EURUSD', 'BTCUSD'
  const symbol = pair.replace('/', '');
  
  return (
    <ClientOnlyTradingView symbol={symbol} timeframe={timeframe} />
  );
}
