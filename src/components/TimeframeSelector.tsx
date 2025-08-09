"use client";
import { useEffect, useMemo, useState } from 'react';
import { getDefaultTimeframe, sanitizeTimeframe, type Timeframe } from '../lib/timeframes';

interface TimeframeSelectorProps {
  readonly onChange: (timeframe: string) => void;
}

export default function TimeframeSelector({ onChange }: TimeframeSelectorProps) {
  const timeframes = ['1m', '5m', '15m', '30m', '1H', '4H', '1D'];
  const envDefault = useMemo(() => getDefaultTimeframe(), []);
  const initial: Timeframe = (() => {
    if (typeof window === 'undefined') return envDefault;
    try {
      const saved = window.localStorage.getItem('ts:lastTimeframe');
      return sanitizeTimeframe(saved || envDefault, envDefault);
    } catch {
      return envDefault;
    }
  })();
  const [selected, setSelected] = useState<Timeframe>(initial);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tf = e.target.value as Timeframe;
    setSelected(tf);
    onChange(tf);
  };

  useEffect(() => {
    try { if (typeof window !== 'undefined') window.localStorage.setItem('ts:lastTimeframe', selected); } catch {}
  }, [selected]);

  return (
    <div className="flex items-center space-x-2 mb-4">
  <label htmlFor="timeframe" className="font-medium">Timeframe:</label>
      <select
        id="timeframe"
        className="select-light rounded-md border bg-white text-slate-900 px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/60"
        value={selected}
        onChange={handleChange}
      >
        {timeframes.map((tf) => (
          <option key={tf} value={tf} className="text-slate-900 bg-white">{tf}</option>
        ))}
      </select>
    </div>
  );
}
