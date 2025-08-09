"use client";
import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { FullSignalResult } from '../lib/signals';

// Define props for TradingViewWidget
interface TradingViewWidgetProps {
  symbol: string;
  autosize?: boolean;
  theme?: string;
  interval?: string;
}
// Dynamically import TradingViewWidget on client only with correct typing
const TradingViewWidget = dynamic<TradingViewWidgetProps>(
  () => import('react-tradingview-widget').then((mod) => mod.default),
  { ssr: false }
);
import TimeframeSelector from './TimeframeSelector';

export interface NewsItem { title: string; url: string; }
export interface SignalData extends FullSignalResult {}

export default function SignalDetailClient({ signal }: { readonly signal: FullSignalResult }) {
  const [timeframe, setTimeframe] = useState(signal.timeframe);
  const [currentSignal, setCurrentSignal] = useState<FullSignalResult>(signal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  let typeColor = 'text-gray-600';
  if (currentSignal.type === 'Buy') typeColor = 'text-green-600';
  else if (currentSignal.type === 'Sell') typeColor = 'text-red-600';

  const fundamentalScore = currentSignal.fundamentals?.score ?? currentSignal.fundamentalScore;
  const fundamentalScoreDisplay = fundamentalScore != null ? Math.round(fundamentalScore) : '—';

  // Map UI timeframe to TradingView interval values
  const tvInterval = (() => {
    switch (timeframe) {
      case '1m': return '1';
      case '5m': return '5';
      case '15m': return '15';
      case '30m': return '30';
      case '1H': return '60';
      case '4H': return '240';
      case '1D': return 'D';
      default: return '60';
    }
  })();

  // When timeframe changes, fetch a fresh signal for this pair and update the UI
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
  async function load() {
      try {
        setLoading(true);
        setError(null);
        const url = `/api/signals?pairs=${encodeURIComponent(signal.pair)}&timeframe=${encodeURIComponent(timeframe)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const updated: FullSignalResult | undefined = json?.signals?.[0];
        if (!cancelled && updated) {
          setCurrentSignal(updated);
        }
      } catch (e) {
    const err = e as any;
    const name: string | undefined = (err && typeof err === 'object' && 'name' in err) ? String(err.name) : undefined;
    const msg: string = e instanceof Error ? e.message : String(e);
        // Log for diagnostics and surface a concise message to the UI
        console.error('Signal update failed:', msg);
    if (!cancelled && name !== 'AbortError') {
          setError(`Failed to update for selected timeframe (${msg}).`);
        }
    // Rethrow so callers can decide how to handle; we swallow at invocation site
    throw e;
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
  load().catch(() => { /* handled above; no-op */ });
    return () => { cancelled = true; controller.abort(); };
  }, [signal.pair, timeframe]);

  return (
    <div className="space-y-6">
  <h1 className="text-3xl font-bold">Signal for {currentSignal.pair}</h1>

      {/* Make the internal selector readable on dark bg */}
      <div className="flex items-center gap-3">
        <div className="select-light inline-block">
          <TimeframeSelector onChange={setTimeframe} />
        </div>
        {loading && <span className="text-xs text-cyan-300">Updating…</span>}
        {error && <span className="text-xs text-rose-300">{error}</span>}
      </div>

      <div className="h-64">
        <TradingViewWidget
          symbol={currentSignal.pair.replace('/', '')}
          autosize
          theme="dark"
          interval={tvInterval}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Signal</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Type: <span className={`font-semibold ${typeColor}`}>{currentSignal.type}</span></li>
            <li>Confidence: {currentSignal.confidence}%</li>
            <li>Timeframe: {timeframe}</li>
            <li>Buy: {currentSignal.buyLevel}</li>
            <li>Stop: {currentSignal.stopLoss}</li>
            <li>Target: {currentSignal.takeProfit}</li>
            <li>Risk/Reward: {currentSignal.riskReward?.toFixed?.(2) ?? '—'}</li>
            <li>Risk: {currentSignal.riskCategory ?? '—'}</li>
            <li>Volatility: {currentSignal.volatilityPct?.toFixed?.(2) ?? '—'}%</li>
          </ul>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Technical</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li>RSI: {currentSignal.indicators?.rsi?.toFixed?.(2) ?? '—'}</li>
            <li>SMA50: {currentSignal.indicators?.sma50?.toFixed?.(2) ?? '—'}</li>
            <li>SMA200: {currentSignal.indicators?.sma200?.toFixed?.(2) ?? '—'}</li>
            <li>EMA20: {currentSignal.indicators?.ema20?.toFixed?.(2) ?? '—'}</li>
            <li>EMA50: {currentSignal.indicators?.ema50?.toFixed?.(2) ?? '—'}</li>
            <li>ATR(est): {currentSignal.indicators?.atr?.toFixed?.(2) ?? '—'}</li>
            <li>MACD: {currentSignal.indicators?.macd?.toFixed?.(2) ?? '—'}</li>
            <li>MACD Signal: {currentSignal.indicators?.macdSignal?.toFixed?.(2) ?? '—'}</li>
            <li>MACD Hist: {currentSignal.indicators?.macdHist?.toFixed?.(2) ?? '—'}</li>
            <li className="mt-2">Technical Score: {currentSignal.technicalScore ?? '—'}</li>
          </ul>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Fundamentals</h2>
          <p className="text-sm mb-2">Score: {fundamentalScoreDisplay}</p>
          <ul className="list-disc list-inside mt-2 text-xs space-y-1 max-h-40 overflow-auto pr-1">
            {currentSignal.fundamentals?.factors?.map(f => <li key={f}>{f}</li>)}
          </ul>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Composite & Sections</h2>
          <p className="text-sm">Composite: {currentSignal.compositeScore ?? '—'}</p>
          <div className="mt-2 space-y-3 max-h-48 overflow-auto pr-1">
            {currentSignal.explanationSections?.map(sec => (
              <div key={sec.title}>
                <h3 className="font-semibold text-sm mb-1">{sec.title}</h3>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {sec.details.map(d => <li key={d}>{d}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
        <h2 className="text-xl font-semibold">Analysis & News</h2>
        <p className="mt-2 text-sm leading-relaxed">{currentSignal.explanation}</p>
        <h3 className="mt-4 font-semibold">Related News</h3>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
          {currentSignal.news.map((item) => (
            <li key={item.url}>
              <a href={item.url} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
