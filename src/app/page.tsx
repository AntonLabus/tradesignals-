import Link from 'next/link';
import { Metadata } from 'next';
import type { FullSignalResult } from '../lib/signals';
import { getDefaultTimeframe } from '../lib/timeframes';

export const metadata: Metadata = {
  title: 'Home · TradeSignals',
  description: 'Overview of how TradeSignals generates Forex and Crypto trading signals',
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  // Fetch current signals (default pairs) and surface active Buy/Sell
  let active: FullSignalResult[] = [];
  try {
  const defaultTf = getDefaultTimeframe();
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/api/signals?timeframe=${defaultTf}&debug=1`, { cache: 'no-store', next: { revalidate: 0 } });
    const json = await res.json();
    const signals = (json?.signals ?? []) as FullSignalResult[];
    active = signals.filter(s => s && (s.type === 'Buy' || s.type === 'Sell'))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 8);
  } catch {
    // ignore; show static content if API unavailable
  }
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

      {/* Live Signals (Buy/Sell) */}
      {active.length > 0 && (
        <section className="glass p-6">
          <h3 className="text-2xl font-semibold mb-3">Live Signals</h3>
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
            {active.map(sig => {
              const [base, quote] = (sig.pair || '').split('/');
              const href = base && quote ? `/signals/${encodeURIComponent(base)}/${encodeURIComponent(quote)}` : '/signals';
              const typeColor = sig.type === 'Buy' ? 'text-green-500' : 'text-red-500';
              return (
                <Link key={`${sig.pair}-${sig.timeframe}`} href={href} className="block bg-white/70 dark:bg-gray-800/70 rounded-md p-4 hover:bg-white/80 dark:hover:bg-gray-800 transition">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{sig.pair}</div>
                    <div className={`text-sm font-bold ${typeColor}`}>{sig.type}</div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">TF {sig.timeframe} · Conf {Math.round(sig.confidence)}%</div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-gray-500">Buy</span><div className="font-mono">{sig.buyLevel?.toFixed?.(4) ?? '—'}</div></div>
                    <div><span className="text-gray-500">SL</span><div className="font-mono">{sig.stopLoss?.toFixed?.(4) ?? '—'}</div></div>
                    <div><span className="text-gray-500">TP</span><div className="font-mono">{sig.takeProfit?.toFixed?.(4) ?? '—'}</div></div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
        <div className="mt-2 grid md:grid-cols-2 gap-3 text-sm">
          <div>
            <h5 className="font-semibold text-gray-200">Shipped</h5>
            <ul className="list-disc list-inside mt-1 space-y-1 text-gray-300">
              <li>Deeper macro ingestion (FOMC/ECB/CPI basics with tone scoring)</li>
              <li>Pattern recognition & volatility filters (candlesticks + ATR proxy)</li>
              <li>Watchlists, alerts, and backtests (UI + API)</li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold text-gray-200">Up next</h5>
            <ul className="list-disc list-inside mt-1 space-y-1 text-gray-300">
              <li>Deeper macro coverage (more sources, better weighting)</li>
              <li>Alert channels (email/Webhook) and thresholds</li>
              <li>Backtest parameter presets and result sharing</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
