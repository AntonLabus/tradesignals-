"use client";
import React, { useEffect, useRef } from 'react';
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, TimeScale, Title, Tooltip } from 'chart.js';
import axios from 'axios';

// Register necessary Chart.js components
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, TimeScale, Title, Tooltip);

interface SparklineChartProps {
  readonly pair: string;
  readonly timeframe: string;
}

export default function SparklineChart(props: Readonly<SparklineChartProps>) {
  const { pair, timeframe } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let chartInstance: Chart<'line'>;
    async function fetchData() {
      // Fetch historical close prices
      let closes: number[] = [];
      let labels: string[] = [];
      const isCrypto = ['BTC','ETH','LTC','XRP','BNB','ADA','DOGE'].includes(pair.split('/')[0].toUpperCase());
      if (isCrypto) {
        const id = pair.split('/')[0].toLowerCase();
        const res = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, {
          params: { vs_currency: 'usd', days: 7 }
        });
        const data = res.data.prices as [number, number][];
        closes = data.map((p) => p[1]);
        labels = data.map((p) => new Date(p[0]).toLocaleDateString());
      } else {
        const [from, to] = pair.split('/');
        const key = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY;
        const res = await axios.get('https://www.alphavantage.co/query', {
          params: { function: 'FX_DAILY', from_symbol: from, to_symbol: to, apikey: key }
        });
        const series = res.data['Time Series FX (Daily)'] || {};
        const entries = Object.entries(series).slice(0, 7).reverse();
        closes = entries.map(([, d]: any) => parseFloat(d['4. close']));
        labels = entries.map(([date]) => date);
      }
      if (canvasRef.current) {
        chartInstance = new Chart(canvasRef.current, {
          type: 'line',
          data: { labels, datasets: [{ data: closes, borderWidth: 1, borderColor: '#3b82f6', pointRadius: 0 }] },
          options: { responsive: false, plugins: { title: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }
        });
      }
    }
    fetchData();
    return () => { chartInstance?.destroy(); };
  }, [pair, timeframe]);

  return <canvas ref={canvasRef} width={100} height={50} />;
}
