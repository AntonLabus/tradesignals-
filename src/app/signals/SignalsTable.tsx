"use client";
import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import SimpleChart from '../../components/SimpleChart';
import type { FullSignalResult } from '../../lib/signals';

// Type aliases for filters (Sonar S4323)
type AssetFilter = 'All' | 'Forex' | 'Crypto';
type SignalTypeFilter = 'All' | 'Buy' | 'Sell' | 'Hold';

// Narrow subset type (reuse interface)
interface SignalsTableProps {
  readonly signals: FullSignalResult[];
  readonly showInlineFilters?: boolean;
  readonly externalFilters?: {
    assetFilter: AssetFilter;
    setAssetFilter: (v: AssetFilter) => void;
    typeFilter: SignalTypeFilter;
    setTypeFilter: (v: SignalTypeFilter) => void;
    timeframeFilter: string;
    setTimeframeFilter: (v: string) => void;
  };
  readonly onSignalsUpdate?: (signals: FullSignalResult[]) => void;
}

function badgeColor(type: string) {
  if (type === 'Buy') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (type === 'Sell') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}
function riskColor(risk?: string) {
  switch (risk) {
    case 'Low': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'Medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'High': return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
    default: return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  }
}

export default function SignalsTable({ signals: initial, showInlineFilters = true, externalFilters, onSignalsUpdate }: SignalsTableProps) {
  const [signals, setSignals] = useState<FullSignalResult[]>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenStaleKeys, setHiddenStaleKeys] = useState<Set<string>>(new Set());
  const staleTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const STALE_TIMEOUT_MS = 8000; // auto-hide spinner/badge after N ms
  const makeKey = (s: FullSignalResult) => s.pair + s.timeframe;
  const hideKey = (key: string) => setHiddenStaleKeys(prev => { const next = new Set(prev); next.add(key); return next; });
  const showKey = (key: string) => setHiddenStaleKeys(prev => { const next = new Set(prev); next.delete(key); return next; });

  // filters (controlled or uncontrolled)
  const [assetFilterInternal, setAssetFilterInternal] = useState<AssetFilter>(externalFilters?.assetFilter ?? 'All');
  const [typeFilterInternal, setTypeFilterInternal] = useState<SignalTypeFilter>(externalFilters?.typeFilter ?? 'All');
  const [timeframeFilterInternal, setTimeframeFilterInternal] = useState<string>(externalFilters?.timeframeFilter ?? 'All');

  const assetFilter = externalFilters?.assetFilter ?? assetFilterInternal;
  const setAssetFilter = externalFilters?.setAssetFilter ?? setAssetFilterInternal;
  const typeFilter = externalFilters?.typeFilter ?? typeFilterInternal;
  const setTypeFilter = externalFilters?.setTypeFilter ?? setTypeFilterInternal;
  const timeframeFilter = externalFilters?.timeframeFilter ?? timeframeFilterInternal;
  const setTimeframeFilter = externalFilters?.setTimeframeFilter ?? setTimeframeFilterInternal;

  async function fetchAll(controller: AbortController) {
    const res = await fetch(`/api/signals`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    return res.json();
  }

  async function fetchBatchesByTimeframe(pairs: string[], timeframe: string, controller: AbortController, onPartial: (partial: FullSignalResult[]) => void) {
    const batchSize = 6;
    const combined: FullSignalResult[] = [];
    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize);
      const url = `/api/signals?pairs=${encodeURIComponent(batch.join(','))}&timeframe=${encodeURIComponent(timeframe)}`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const json = await res.json();
      combined.push(...(json.signals as FullSignalResult[]));
      onPartial([...combined]);
    }
    return combined;
  }

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // If a specific timeframe is selected, request in batches by pairs
        if (timeframeFilter !== 'All' && signals.length > 0) {
          const uniquePairs = Array.from(new Set(signals.map((s) => s.pair)));
          const combined = await fetchBatchesByTimeframe(uniquePairs, timeframeFilter, controller, (partial) => {
            if (!aborted) { setSignals(partial); onSignalsUpdate?.(partial); }
          });
          if (!aborted) { setSignals(combined); onSignalsUpdate?.(combined); }
        } else {
          const json = await fetchAll(controller);
          if (!aborted) {
            setSignals(json.signals);
            onSignalsUpdate?.(json.signals);
          }
        }
      } catch (e: unknown) {
        const err = e as any;
        const name: string | undefined = (err && typeof err === 'object' && 'name' in err) ? String(err.name) : undefined;
        if (!aborted && name !== 'AbortError') setError((err?.message as string) || 'Failed');
      } finally {
        if (!aborted) setLoading(false);
      }
    })().catch(() => { /* handled above */ });
    return () => { aborted = true; controller.abort(); };
  }, [onSignalsUpdate, timeframeFilter]);

  // Auto-hide stale spinners/badges after N seconds, and clear when fresh data arrives.
  // Effect 1: schedule timers for currently stale rows
  useEffect(() => {
    const timers = staleTimers.current;
    for (const s of signals) {
      const key = makeKey(s);
      if (s.stale && !hiddenStaleKeys.has(key) && !timers.has(key)) {
        const id = setTimeout(() => { hideKey(key); timers.delete(key); }, STALE_TIMEOUT_MS);
        timers.set(key, id);
      }
    }
  }, [signals, hiddenStaleKeys]);

  // Effect 2: clear timers and badges when fresh data arrives
  useEffect(() => {
    const timers = staleTimers.current;
    for (const s of signals) {
      const key = makeKey(s);
      if (!s.stale) {
        const t = timers.get(key);
        if (t) { clearTimeout(t); timers.delete(key); }
        if (hiddenStaleKeys.has(key)) showKey(key);
      }
    }
  }, [signals]);

  // Effect 3: cleanup timers for rows that disappeared
  useEffect(() => {
    const timers = staleTimers.current;
    const present = new Set(signals.map(makeKey));
    for (const key of Array.from(timers.keys())) {
      if (!present.has(key)) {
        const t = timers.get(key);
        if (t) clearTimeout(t);
        timers.delete(key);
      }
    }
  }, [signals]);

  const timeframes = Array.from(new Set(signals.map((s) => s.timeframe)));
  const filtered = signals.filter(
    (s) =>
      (assetFilter === 'All' || s.assetClass === assetFilter) &&
      (typeFilter === 'All' || s.type === typeFilter) &&
      (timeframeFilter === 'All' || s.timeframe === timeframeFilter)
  );

  if (loading) return <div className="p-4 text-sm text-gray-300">Loading signals...</div>;
  if (error) return <div className="p-4 text-sm text-rose-400">Error: {error}</div>;

  return (
    <div className="space-y-4">
      {showInlineFilters && (
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label htmlFor="assetFilter" className="block text-sm font-medium">Asset Class</label>
            <select id="assetFilter" className="border rounded p-1 bg-white dark:bg-gray-800" value={assetFilter} onChange={(e) => setAssetFilter(e.target.value as AssetFilter)}>
              <option value="All">All</option>
              <option value="Forex">Forex</option>
              <option value="Crypto">Crypto</option>
            </select>
          </div>
          <div>
            <label htmlFor="typeFilter" className="block text-sm font-medium">Type</label>
            <select id="typeFilter" className="border rounded p-1 bg-white dark:bg-gray-800" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as SignalTypeFilter)}>
              <option value="All">All</option>
              <option value="Buy">Buy</option>
              <option value="Sell">Sell</option>
              <option value="Hold">Hold</option>
            </select>
          </div>
          <div>
            <label htmlFor="timeframeFilter" className="block text-sm font-medium">Timeframe</label>
            <select id="timeframeFilter" className="border rounded p-1 bg-white dark:bg-gray-800" value={timeframeFilter} onChange={(e) => setTimeframeFilter(e.target.value)}>
              <option value="All">All</option>
              {timeframes.map((tf) => (<option key={tf} value={tf}>{tf}</option>))}
            </select>
          </div>
        </div>
      )}
      <div className="overflow-x-auto glass">
        <table className="min-w-full table-auto text-sm">
          <thead className="text-xs uppercase tracking-wide text-gray-300">
            <tr>
              <th className="px-4 py-2">Chart</th>
              <th className="px-4 py-2">Pair</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Conf</th>
              <th className="px-4 py-2">T/F</th>
              <th className="px-4 py-2">Timeframe</th>
              <th className="px-4 py-2">Levels</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(sig => {
              const staleKey = sig.pair + sig.timeframe;
              const showStale = Boolean(sig.stale) && !hiddenStaleKeys.has(staleKey);
              let confColor: string;
              if (sig.confidence > 70) confColor = 'bg-green-500';
              else if (sig.confidence > 40) confColor = 'bg-amber-500';
              else confColor = 'bg-red-500';

              const tech = sig.technicalScore ?? undefined;
              const fund = sig.fundamentals?.score ?? sig.fundamentalScore ?? undefined;
              const techDisplay = tech != null ? Math.round(tech) : undefined;
              const fundDisplay = fund != null ? Math.round(fund) : undefined;
              const tfTooltip = `Risk: ${sig.riskCategory ?? '—'} | Vol: ${sig.volatilityPct?.toFixed?.(2) ?? '—'}% | R/R: ${sig.riskReward?.toFixed?.(2) ?? '—'}`;

              return (
                <React.Fragment key={sig.pair+sig.timeframe}>
                  <tr className="hover:bg-white/5 border-b-0" title={tfTooltip}>
                    <td className="px-4 py-2 relative">
                      <SimpleChart pair={sig.pair} signalType={sig.type} confidence={sig.confidence} history={sig.history} />
                      {showStale ? (
                        <div className="absolute top-1 left-1 flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5" title="Refreshing">
                          <span className="inline-block w-2 h-2 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <Link href={`/signals/${encodeURIComponent(sig.pair)}`} className="text-neon-cyan hover:underline font-medium">
                        {sig.pair}
                      </Link>
                      <div className="text-[10px] text-gray-400">{sig.assetClass}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold inline-block ${badgeColor(sig.type)}`}>{sig.type}</span>
                        {showStale ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium inline-block bg-amber-500/10 text-amber-300 border border-amber-500/20" title="Soft-stale; refreshing soon">Refreshing…</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2 w-28">
                      <div className="w-full bg-white/10 h-2 rounded overflow-hidden" title={`${sig.confidence}%`}>
                        <div className={`h-full ${confColor}`} style={{ width: `${sig.confidence}%` }} />
                      </div>
                      <div className="text-[10px] mt-1 text-gray-400 text-right">{sig.confidence}%</div>
                    </td>
                    <td className="px-4 py-2 text-center" title={tfTooltip}>
                      {tech != null || fund != null ? (
                        <div className="flex items-center justify-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1"><span className="text-gray-500">T</span> {techDisplay ?? '—'}</span>
                          <span className="text-gray-600">/</span>
                          <span className="inline-flex items-center gap-1"><span className="text-gray-500">F</span> {fundDisplay ?? '—'}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2 text-center">{sig.timeframe}</td>
                    <td className="px-4 py-2 text-[11px] whitespace-nowrap">
                      <span className="font-semibold">B</span> {sig.buyLevel} <span className="text-gray-500">|</span> <span className="font-semibold text-rose-400">SL</span> {sig.stopLoss} <span className="text-gray-500">|</span> <span className="font-semibold text-green-400">TP</span> {sig.takeProfit}
                    </td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="px-4 pb-3 text-[10px] text-gray-400" colSpan={7}>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium inline-block align-middle ${riskColor(sig.riskCategory)}`}>{sig.riskCategory ?? '—'}</span>
                      <span className="ml-2 align-middle">Vol: {sig.volatilityPct?.toFixed?.(2) ?? '—'}%</span>
                      <span className="ml-2 align-middle">R/R: {sig.riskReward?.toFixed?.(2) ?? '—'}</span>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
