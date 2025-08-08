import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home · TradeSignals',
  description: 'Overview of how TradeSignals generates Forex and Crypto trading signals',
};

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="glass relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(600px_200px_at_20%_-20%,rgba(34,225,255,0.12),transparent),radial-gradient(600px_200px_at_80%_-10%,rgba(161,47,255,0.12),transparent)] pointer-events-none" />
        <div className="relative px-6 py-10 md:py-14">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">AI‑driven Signals for Forex & Crypto</h2>
          <p className="mt-3 text-sm md:text-base text-gray-300 max-w-3xl">
            Real-time Buy, Sell, Hold recommendations blending technical momentum and macro fundamentals. Built on free data and optimized for speed.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signals" className="btn-primary">Open Signals Dashboard</Link>
            <a href="#how" className="badge">How it works</a>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section id="how" className="grid md:grid-cols-3 gap-6">
        <div className="card">
          <h4 className="font-semibold mb-1">Multi-Timeframe</h4>
          <p className="text-sm text-gray-300">Analyze 1m → 1D with adaptive MACD/EMA settings and trend filters.</p>
        </div>
        <div className="card">
          <h4 className="font-semibold mb-1">Technical + Fundamental</h4>
          <p className="text-sm text-gray-300">Blend RSI, MACD, MAs with news sentiment and market regime signals.</p>
        </div>
        <div className="card">
          <h4 className="font-semibold mb-1">Actionable Levels</h4>
          <p className="text-sm text-gray-300">Each signal includes entry, stop-loss, and take-profit guidance.</p>
        </div>
      </section>

      {/* Roadmap */}
      <section className="glass p-6">
        <h3 className="text-2xl font-semibold">Roadmap</h3>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-300">
          <li>Deeper macro ingestion (FOMC/ECB releases, CPI)</li>
          <li>Pattern recognition & volatility filters</li>
          <li>Watchlists, alerts, and backtests</li>
        </ul>
      </section>
    </div>
  );
}
