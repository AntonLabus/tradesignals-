"use client";
import { useState } from 'react';

interface TimeframeSelectorProps {
  readonly onChange: (timeframe: string) => void;
}

export default function TimeframeSelector({ onChange }: TimeframeSelectorProps) {
  const timeframes = ['1m', '5m', '15m', '30m', '1H', '4H', '1D'];
  const [selected, setSelected] = useState('1H');

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tf = e.target.value;
    setSelected(tf);
    onChange(tf);
  };

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
