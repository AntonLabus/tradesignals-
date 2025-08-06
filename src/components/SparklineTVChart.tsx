"use client";
import dynamic from 'next/dynamic';
// Dynamically import TradingViewWidget for client-side only
const TradingViewWidget = dynamic<TradingViewWidgetProps>(
  () => import('react-tradingview-widget').then((mod) => mod.default),
  { ssr: false }
);

// Define props for TradingViewWidget
interface TradingViewWidgetProps {
  symbol: string;
  autosize?: boolean;
  width?: number;
  height?: number;
  interval?: string;
  theme?: string;
}

interface SparklineTVChartProps {
  pair: string;
  timeframe: string;
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
