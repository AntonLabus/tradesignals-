"use client";
import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDefaultTimeframe, sanitizeTimeframe } from '../lib/timeframes';

type Props = {
  readonly value?: string;
  readonly onChange?: (tf: string) => void;
};

export default function TimeframeSelectorClient({ value, onChange }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tfs = ['1m','5m','15m','30m','1H','4H','1D'];
  const envDefault = useMemo(() => getDefaultTimeframe(), []);
  const fromParam = searchParams.get('timeframe');
  const persisted = typeof window !== 'undefined' ? window.localStorage.getItem('ts:lastTimeframe') : null;
  const selectedValue = value ?? (fromParam || persisted || envDefault);
  const safeSelected = sanitizeTimeframe(selectedValue, envDefault);

  const handleChange = (tf: string) => {
    onChange?.(tf);
    try { if (typeof window !== 'undefined') window.localStorage.setItem('ts:lastTimeframe', tf); } catch { /* ignore */ }
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('timeframe', tf); // preserve other params
    router.push(`?${params.toString()}`);
  };

  return (
    <select
      aria-label="Timeframe"
      value={safeSelected}
      onChange={(e) => handleChange(e.target.value)}
      className="select-light rounded-md border bg-white text-slate-900 px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
    >
      {tfs.map((tf) => (
        <option key={tf} value={tf} className="text-slate-900 bg-white">
          {tf}
        </option>
      ))}
    </select>
  );
}
