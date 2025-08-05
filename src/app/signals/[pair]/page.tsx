import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCryptoPrice, getForexPrice, getNews } from '../../../lib/api';
import SignalDetailClient from '../../../components/SignalDetailClient';

// Helper to determine asset class (extend this list as needed)
function isCrypto(pair: string) {
  const base = pair.split('/')[0];
  return ['BTC', 'ETH', 'LTC', 'XRP', 'BNB', 'ADA', 'DOGE'].includes(base.toUpperCase());
}

export async function generateMetadata({ params, searchParams }: Readonly<{ 
  params: Promise<{ pair: string }>; 
  searchParams: Promise<Record<string, string | string[]>>; 
}>): Promise<Metadata> {
  const resolvedParams = await params;
  const { pair } = resolvedParams;
  return {
    title: `${pair} · Signal Detail · TradeSignals`,
    description: `Detailed trading signal for ${pair}: confidence, levels, and analysis.`,
  };
}

export default async function SignalDetailPage({ params, searchParams }: Readonly<{ 
  params: Promise<{ pair: string }>; 
  searchParams: Promise<Record<string, string | string[]>>; 
}>) {
  const resolvedParams = await params;
  const pair = decodeURIComponent(resolvedParams.pair);
  if (!pair) notFound();

  // Determine asset class and fetch price
  const assetClass = isCrypto(pair) ? 'Crypto' : 'Forex';
  const { price } =
    assetClass === 'Crypto'
      ? await getCryptoPrice(pair)
      : await getForexPrice(pair);

  // Fetch recent news
  const articles = await getNews();

  // Build signal data (mock analysis based on price)
  const signal = {
    pair,
    assetClass,
    type: 'Buy' as const,
    confidence: Math.round(Math.random() * 100),
    timeframe: '1H',
    buyLevel: parseFloat((price * 0.98).toFixed(4)),
    stopLoss: parseFloat((price * 0.95).toFixed(4)),
    takeProfit: parseFloat((price * 1.05).toFixed(4)),
    explanation: 'Generated based on price momentum and key indicators.',
    news: articles.slice(0, 3).map((a: { title: string; url: string }) => ({ title: a.title, url: a.url })),
  };

  // Render client-side signal detail with timeframe selector and interactive chart
  return <SignalDetailClient signal={signal} />;
}
