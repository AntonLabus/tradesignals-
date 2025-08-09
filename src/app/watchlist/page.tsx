"use client";
import { getDefaultTimeframe } from '../../lib/timeframes';

// Client page uses only localStorage and polling; no need for route-level revalidate/dynamic exports.

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function WatchlistPage() {
  const [pairs, setPairs] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('watchlist') || '[]'); } catch { return []; }
  });
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
  const params = new URLSearchParams({ timeframe: getDefaultTimeframe() });
        const res = await fetch(`/api/signals?${params}`);
        const json = await res.json();
        const signals = json?.signals || [];
        const interesting = signals.filter((s: any) => pairs.includes(s.pair) && (s.type === 'Buy' || s.type === 'Sell'));
        if (interesting.length) setAlerts(interesting.map((s: any) => `${s.pair} → ${s.type} (${Math.round(s.confidence)}%)`));
      } catch { /* ignore */ }
    }, 30000);
    return () => clearInterval(id);
  }, [pairs]);

  function addPair(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const raw = fd.get('pair');
  const p = (typeof raw === 'string' ? raw : '').toUpperCase();
    if (!p || pairs.includes(p)) return;
    const next = [...pairs, p];
    setPairs(next);
    if (typeof window !== 'undefined') localStorage.setItem('watchlist', JSON.stringify(next));
    e.currentTarget.reset();
  }
  function removePair(p: string) {
    const next = pairs.filter(x => x !== p);
    setPairs(next);
    if (typeof window !== 'undefined') localStorage.setItem('watchlist', JSON.stringify(next));
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Watchlist</h2>
      <form onSubmit={addPair} className="flex gap-2">
        <input name="pair" placeholder="e.g., EUR/USD or BTC/USD" className="input" />
        <button className="btn-primary" type="submit">Add</button>
      </form>
      <ul className="divide-y divide-gray-700/30 rounded-md overflow-hidden">
        {pairs.map(p => (
          <li key={p} className="flex items-center justify-between p-3 bg-white/60 dark:bg-gray-800/60">
            <div>
              <div className="font-medium">{p}</div>
              <div className="text-xs text-gray-500">1H alerts via polling</div>
            </div>
            <div className="flex items-center gap-2">
              <Link className="badge" href={`/signals/${encodeURIComponent(p.split('/')[0])}/${encodeURIComponent(p.split('/')[1] || 'USD')}`}>Open</Link>
              <button onClick={() => removePair(p)} className="badge">Remove</button>
            </div>
          </li>
        ))}
      </ul>
      <div>
        <h3 className="text-xl font-semibold mb-2">Alerts</h3>
    {alerts.length === 0 ? <div className="text-sm text-gray-500">No new alerts</div> : (
          <ul className="list-disc list-inside text-sm">
      {alerts.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
