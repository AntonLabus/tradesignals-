import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home · TradeSignals',
  description: 'Overview of how TradeSignals generates Forex and Crypto trading signals',
};

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section>
        <h2 className="text-3xl font-bold">Welcome to TradeSignals</h2>
        <p className="mt-2 text-lg">
          Get real-time Buy, Sell, and Hold signals for major Forex and Crypto pairs, based on technical and fundamental analysis.
        </p>
      </section>
      {/* How it works */}
      <section>
        <h3 className="text-2xl font-semibold">How It Works</h3>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Fetch historical and live market data</li>
          <li>Apply technical indicators: RSI, MACD, MAs</li>
          <li>Incorporate relevant news and fundamentals</li>
          <li>Compute confidence score and recommended levels</li>
        </ul>
      </section>
      {/* Feature grid */}
      <section className="grid md:grid-cols-3 gap-6 mt-8">
        <div className="p-4 rounded border dark:border-gray-700">
          <h4 className="font-semibold mb-2">Multi-Timeframe</h4>
          <p className="text-sm">Analyze signals across 1m to 1D with adaptive indicator settings.</p>
        </div>
        <div className="p-4 rounded border dark:border-gray-700">
          <h4 className="font-semibold mb-2">Technical + Fundamental</h4>
          <p className="text-sm">Blend RSI, MACD, MAs with news sentiment and macro context.</p>
        </div>
        <div className="p-4 rounded border dark:border-gray-700">
          <h4 className="font-semibold mb-2">Actionable Levels</h4>
          <p className="text-sm">Each signal includes buy, stop-loss and take-profit guidance.</p>
        </div>
      </section>
      {/* Roadmap */}
      <section>
        <h3 className="text-2xl font-semibold">Roadmap</h3>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
          <li>Deeper macro ingestion (rates, CPI releases)</li>
          <li>Pattern recognition & volatility filters</li>
          <li>User watchlists & alerts</li>
        </ul>
      </section>
      {/* CTA */}
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
