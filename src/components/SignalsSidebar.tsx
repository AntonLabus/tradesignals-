"use client";
import React, { useMemo, useState } from 'react';
import type { FullSignalResult } from '../lib/signals';

interface SignalsSidebarProps {
  readonly signals: FullSignalResult[];
  readonly filters: {
    assetFilter: 'All' | 'Forex' | 'Crypto';
    setAssetFilter: (v: 'All' | 'Forex' | 'Crypto') => void;
    typeFilter: 'All' | 'Buy' | 'Sell' | 'Hold';
    setTypeFilter: (v: 'All' | 'Buy' | 'Sell' | 'Hold') => void;
    timeframeFilter: string;
    setTimeframeFilter: (v: string) => void;
    timeframes: string[];
  }
}

export default function SignalsSidebar({ signals, filters }: SignalsSidebarProps) {
  const { assetFilter, setAssetFilter, typeFilter, setTypeFilter, timeframeFilter, setTimeframeFilter, timeframes } = filters;
  const [expanded, setExpanded] = useState(true);

  const counts = useMemo(() => {
    const total = signals.length;
    const byType = signals.reduce((acc, s) => { acc[s.type] = (acc[s.type] || 0) + 1; return acc; }, {} as Record<string, number>);
    const byClass = signals.reduce((acc, s) => { acc[s.assetClass] = (acc[s.assetClass] || 0) + 1; return acc; }, {} as Record<string, number>);
    const avgConf = total ? Math.round(signals.reduce((sum, s) => sum + (s.confidence || 0), 0) / total) : 0;
    return { total, byType, byClass, avgConf };
  }, [signals]);

  return (
    <aside className={`glass p-4 sticky top-20 self-start ${expanded ? 'w-64' : 'w-14'} transition-all`}>      
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Dashboard</h3>
        <button className="badge" onClick={() => setExpanded(v => !v)}>{expanded ? '⟨' : '⟩'}</button>
      </div>
      <div className="neon-divider my-3" />
      {expanded && (
        <div className="space-y-4 text-sm">
          <div className="flex items-center justify-between"><span>Total</span><span className="font-semibold">{counts.total}</span></div>
          <div className="flex items-center justify-between"><span>Avg Conf</span><span className="font-semibold">{counts.avgConf}%</span></div>
          <div className="flex items-center justify-between"><span>Buy</span><span className="text-green-400">{counts.byType['Buy'] || 0}</span></div>
          <div className="flex items-center justify-between"><span>Sell</span><span className="text-rose-400">{counts.byType['Sell'] || 0}</span></div>
          <div className="flex items-center justify-between"><span>Hold</span><span className="text-gray-400">{counts.byType['Hold'] || 0}</span></div>
          <div className="neon-divider" />
          <div>
            <label htmlFor="sidebar-assetFilter" className="block text-xs mb-1">Asset Class</label>
            <select id="sidebar-assetFilter" className="select-light w-full rounded-md border bg-white text-slate-900 px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/60" value={assetFilter} onChange={(e) => setAssetFilter(e.target.value as any)}>
              <option value="All">All</option>
              <option value="Forex">Forex</option>
              <option value="Crypto">Crypto</option>
            </select>
          </div>
          <div>
            <label htmlFor="sidebar-typeFilter" className="block text-xs mb-1">Type</label>
            <select id="sidebar-typeFilter" className="select-light w-full rounded-md border bg-white text-slate-900 px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/60" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
              <option value="All">All</option>
              <option value="Buy">Buy</option>
              <option value="Sell">Sell</option>
              <option value="Hold">Hold</option>
            </select>
          </div>
          <div>
            <label htmlFor="sidebar-timeframeFilter" className="block text-xs mb-1">Timeframe</label>
            <select id="sidebar-timeframeFilter" className="select-light w-full rounded-md border bg-white text-slate-900 px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/60" value={timeframeFilter} onChange={(e) => setTimeframeFilter(e.target.value)}>
              <option value="All">All</option>
              {timeframes.map(tf => <option key={tf} value={tf} className="text-slate-900 bg-white">{tf}</option>)}
            </select>
          </div>
        </div>
      )}
    </aside>
  );
}
