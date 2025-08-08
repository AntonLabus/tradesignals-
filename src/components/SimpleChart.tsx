"use client";
import React from 'react';

export interface SimpleChartProps { // export for external type checking
  readonly pair: string;
  readonly signalType: 'Buy' | 'Sell' | 'Hold';
  readonly confidence: number;
  readonly history?: ReadonlyArray<number>; // optional closes for sparkline (readonly)
}

export default function SimpleChart(props: Readonly<SimpleChartProps>) {
  const { pair, signalType, confidence, history } = props;

  // Use passed history if present; else generate small mock sequence (client-only)
  const data = React.useMemo(() => {
    if (history && history.length > 1) {
      // downsample to max 40 points for small chart
      const maxPts = 40;
      if (history.length <= maxPts) return [...history];
      const step = Math.floor(history.length / maxPts) || 1;
      return history.filter((_, i) => i % step === 0).slice(-maxPts);
    }
    // fallback mock
    const points = 20;
    const arr: number[] = [];
    let base = 100;
    for (let i = 0; i < points; i++) {
      base += (Math.random() - 0.5) * 10;
      arr.push(base);
    }
    return arr;
  }, [history]);

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pathD = React.useMemo(() => {
    const width = 100;
    const height = 40;
    return data
      .map((v, idx) => {
        const x = (idx / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [data, min, range]);

  let gradientId = 'grad-neutral';
  if (signalType === 'Buy') gradientId = 'grad-buy';
  if (signalType === 'Sell') gradientId = 'grad-sell';

  return (
    <div className="w-[120px] h-[60px] glass p-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <svg width="100" height="40" viewBox="0 0 100 40">
          <defs>
            <linearGradient id="grad-buy" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#22E1FF" />
              <stop offset="100%" stopColor="#B6FF2E" />
            </linearGradient>
            <linearGradient id="grad-sell" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FF4D8D" />
              <stop offset="100%" stopColor="#A12FFF" />
            </linearGradient>
            <linearGradient id="grad-neutral" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path d={pathD} stroke={`url(#${gradientId})`} strokeWidth="1.6" fill="none" filter="url(#glow)" />
          <circle
            cx={100 - 10}
            cy={40 - ((data[data.length - 1] - min) / range) * 40}
            r={1.8}
            fill={`url(#${gradientId})`}
          />
        </svg>
      </div>
      <div className="text-[8px] text-center text-gray-300 font-medium truncate" title={pair}>
        {signalType} {confidence}%
      </div>
    </div>
  );
}
