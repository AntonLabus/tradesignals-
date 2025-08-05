import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home · TradeSignals',
  description: 'Overview of how TradeSignals generates Forex and Crypto trading signals',
};

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-3xl font-bold">Welcome to TradeSignals</h2>
        <p className="mt-2 text-lg">
          Get real-time Buy, Sell, and Hold signals for major Forex and Crypto pairs, based on technical and fundamental analysis.
        </p>
      </section>
      <section>
        <h3 className="text-2xl font-semibold">How It Works</h3>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Fetch historical and live market data</li>
          <li>Apply technical indicators: RSI, MACD, MAs</li>
          <li>Incorporate relevant news and fundamentals</li>
          <li>Compute confidence score and recommended levels</li>
        </ul>
      </section>
      <section>
        <Link
          href="/signals"
          className="inline-block mt-4 px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          View Signals Dashboard
        </Link>
      </section>
    </div>
  );
}
