import axios from 'axios';
import { RSI, SMA } from 'technicalindicators';
import { getCryptoPrice, getForexPrice } from './api';

/**
 * Fetches historical close prices and computes a trading signal
 */
export async function calculateSignal(pair: string, timeframe: string = '1d') {
  const isCrypto = (pair: string) => /USDT$|USD$/.exec(pair) !== null;

  // Fetch historical data
  let closes: number[] = [];
  if (isCrypto(pair)) {
    const id = pair.split('/')[0].toLowerCase();
    // CoinGecko market_chart returns prices array: [timestamp, price]
    const chart = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, {
      params: { vs_currency: 'usd', days: 30 }
    });
    closes = chart.data.prices.map((p: any) => p[1]);
  } else {
    const [from, to] = pair.split('/');
    const key = process.env.ALPHA_VANTAGE_API_KEY;
    const fx = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'FX_DAILY',
        from_symbol: from,
        to_symbol: to,
        apikey: key,
      }
    });
    const series = fx.data['Time Series FX (Daily)'] || {};
    closes = Object.values(series)
      .slice(0, 30)
      .map((d: any) => parseFloat(d['4. close']));
  }

  // Compute indicators
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const smaValues = SMA.calculate({ values: closes, period: 50 });
  const lastClose = closes[closes.length - 1];
  const lastRSI = rsiValues[rsiValues.length - 1] || 50;
  const lastSMA = smaValues[smaValues.length - 1] || lastClose;

  // Determine signal type
  let type: 'Buy' | 'Sell' | 'Hold' = 'Hold';
  if (lastClose > lastSMA && lastRSI < 30) type = 'Buy';
  else if (lastClose < lastSMA && lastRSI > 70) type = 'Sell';

  // Confidence as distance from neutral 50
  const confidence = Math.round(Math.max(0, 100 - Math.abs(50 - lastRSI)));

  // Fetch current price for levels
  const { price } = isCrypto(pair)
    ? await getCryptoPrice(pair)
    : await getForexPrice(pair);

  // Fetch news items for explanation
  const { getNews } = await import('./api');
  let articles: Array<any> = [];
  try {
    articles = await getNews();
  } catch (error) {
    console.error('Error fetching news:', error);
    articles = [];
  }
  const news = articles.slice(0, 3).map((a: any) => ({ title: a.title, url: a.url }));
  // Build plain-English explanation of the rule
  let explanation: string;
  if (type === 'Buy') {
    explanation = `Price ${lastClose.toFixed(2)} > SMA50 ${lastSMA.toFixed(2)} and RSI ${lastRSI.toFixed(0)} < 30 triggered Buy.`;
  } else if (type === 'Sell') {
    explanation = `Price ${lastClose.toFixed(2)} < SMA50 ${lastSMA.toFixed(2)} and RSI ${lastRSI.toFixed(0)} > 70 triggered Sell.`;
  } else {
    explanation = `Conditions not met for Buy/Sell; RSI ${lastRSI.toFixed(0)} is neutral near 50, so Hold.`;
  }
  return {
    pair,
    assetClass: isCrypto(pair) ? 'Crypto' as const : 'Forex' as const,
    type,
    confidence,
    timeframe,
    buyLevel: parseFloat((price * 0.98).toFixed(4)),
    stopLoss: parseFloat((price * 0.95).toFixed(4)),
    takeProfit: parseFloat((price * 1.05).toFixed(4)),
    explanation,
    news,
  };
}
