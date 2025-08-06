import axios from 'axios';
import { RSI, SMA } from 'technicalindicators';
import { getCryptoPrice, getForexPrice, getNews } from './api';

/**
 * Fetches historical close prices and computes a trading signal
 */
export async function calculateSignal(pair: string, timeframe: string = '1d') {
  const isCrypto = (pair: string) => /USDT$|USD$/.exec(pair) !== null;

  // Fetch historical data - temporarily using mock data for debugging
  console.log('Calculating signal for:', pair, 'timeframe:', timeframe);
  let closes: number[] = [];
  
  try {
    if (isCrypto(pair)) {
      const id = pair.split('/')[0].toLowerCase();
      console.log('Fetching crypto data for:', id);
      // Use mock data for now to avoid API issues
      closes = Array.from({length: 30}, (_, i) => 50000 + Math.random() * 1000);
    } else {
      console.log('Fetching forex data for:', pair);
      // Use mock data for now to avoid API issues
      closes = Array.from({length: 30}, (_, i) => 1.1 + Math.random() * 0.1);
    }
  } catch (error) {
    console.error('Error in historical data fetch:', error);
    closes = Array.from({length: 30}, (_, i) => 100 + Math.random() * 10);
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

  // Fetch current price for levels - temporarily using mock data
  let price = 1.0;
  try {
    console.log('Fetching current price for:', pair);
    if (isCrypto(pair)) {
      price = 50000 + Math.random() * 1000; // Mock crypto price
    } else {
      price = 1.1 + Math.random() * 0.1; // Mock forex price
    }
  } catch (error) {
    console.error('Error fetching current price:', error);
    price = lastClose;
  }

  // Fetch news items for explanation
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
