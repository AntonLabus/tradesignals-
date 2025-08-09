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

// Tiny equity sparkline rendered as inline SVG
function EquitySparkline({ values }: Readonly<{ values: number[] }>) {
  if (!values || values.length < 2) return null;
  const width = 160;
  const height = 40;
  // Downsample to at most 80 points for simplicity
  const step = Math.max(1, Math.floor(values.length / 80));
  const pts = values.filter((_, i) => i % step === 0);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const toX = (i: number) => (i / (pts.length - 1)) * width;
  const toY = (v: number) => height - ((v - min) / range) * height;
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(2)} ${toY(v).toFixed(2)}`).join(' ');
  const lastUp = pts[pts.length - 1] >= pts[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="equity curve">
      <path d={d} fill="none" stroke={lastUp ? '#10b981' : '#ef4444'} strokeWidth={1.5} />
    </svg>
  );
}

export default function SignalDetailClient({ signal }: { readonly signal: FullSignalResult }) {
  const [timeframe, setTimeframe] = useState(signal.timeframe);
  const [currentSignal, setCurrentSignal] = useState<FullSignalResult>(signal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Backtest UI state
  const [btLoading, setBtLoading] = useState(false);
  const [btError, setBtError] = useState<string | null>(null);
  const [btResult, setBtResult] = useState<null | {
    pair: string;
    timeframe: string;
    trades: number;
    wins: number;
    winRate: number;
    totalReturnPct: number;
    equityCurve: number[];
    maxDrawdownPct: number;
  }>(null);

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
  const url = `/api/signals?pairs=${encodeURIComponent(signal.pair)}&timeframe=${encodeURIComponent(timeframe)}&debug=1`;
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

  // Trigger a backtest for the current pair/timeframe
  async function runBacktest() {
    try {
      setBtLoading(true);
      setBtError(null);
      setBtResult(null);
      const url = `/api/backtest?pair=${encodeURIComponent(currentSignal.pair)}&timeframe=${encodeURIComponent(timeframe)}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.ok && json?.result) {
        setBtResult(json.result);
      } else {
        throw new Error(json?.error || 'Unknown backtest error');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Backtest failed:', msg);
      setBtError(`Backtest failed: ${msg}`);
    } finally {
      setBtLoading(false);
    }
  }

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
        {/* Backtest card - wraps to new row on smaller widths */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Backtest</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={runBacktest}
              disabled={btLoading}
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white disabled:opacity-50"
            >
              {btLoading ? 'Running…' : 'Run Backtest'}
            </button>
            {btError && <span className="text-xs text-rose-400">{btError}</span>}
          </div>
          {btResult && (
            <div className="mt-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span>Trades</span>
                <span className="font-semibold">{btResult.trades}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Win rate</span>
                <span className="font-semibold">{btResult.winRate.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total return</span>
                <span className={`font-semibold ${btResult.totalReturnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {btResult.totalReturnPct.toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Max drawdown</span>
                <span className="font-semibold">{btResult.maxDrawdownPct.toFixed(1)}%</span>
              </div>
              <div className="mt-2"><EquitySparkline values={btResult.equityCurve} /></div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
        <h2 className="text-xl font-semibold">Analysis & News</h2>
        <p className="mt-2 text-sm leading-relaxed">{currentSignal.explanation}</p>
        {currentSignal.debugSource && (
          <p className="mt-2 text-xs text-gray-400">data source: {currentSignal.debugSource}</p>
        )}
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
