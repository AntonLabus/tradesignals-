"use client";
import React from 'react';

interface SimpleChartProps {
  readonly pair: string;
  readonly signalType: 'Buy' | 'Sell' | 'Hold';
  readonly confidence: number;
}

export default function SimpleChart({ pair, signalType, confidence }: SimpleChartProps) {
  // Generate simple mock data for visualization
  const generateChartData = () => {
    const points = 20;
    const data = [];
    let baseValue = 100;
    
    for (let i = 0; i < points; i++) {
      const variation = (Math.random() - 0.5) * 10;
      baseValue += variation;
      data.push(baseValue);
    }
    
    return data;
  };

  const data = generateChartData();
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;

  // Create SVG path for the chart line
  const createPath = (data: number[]) => {
    const width = 100;
    const height = 40;
    
    return data
      .map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  };

  const getColorBySignal = (signal: string) => {
    switch (signal) {
      case 'Buy': return '#10B981'; // green
      case 'Sell': return '#EF4444'; // red
      default: return '#6B7280'; // gray
    }
  };

  return (
    <div className="w-[120px] h-[60px] bg-white border border-gray-200 rounded p-1 flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <svg width="100" height="40" viewBox="0 0 100 40">
          <path
            d={createPath(data)}
            stroke={getColorBySignal(signalType)}
            strokeWidth="1.5"
            fill="none"
            className="drop-shadow-sm"
          />
          {/* Add dots at key points */}
          <circle
            cx="90"
            cy={40 - ((data[data.length - 1] - min) / range) * 40}
            r="1.5"
            fill={getColorBySignal(signalType)}
          />
        </svg>
      </div>
      <div className="text-[8px] text-center text-gray-600 font-medium">
        {signalType} {confidence}%
      </div>
    </div>
  );
}
