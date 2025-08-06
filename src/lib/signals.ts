import axios from 'axios';
import { RSI, SMA } from 'technicalindicators';
import { getCryptoPrice, getForexPrice, getNews } from './api';

/**
 * Check if a trading pair is a cryptocurrency
 */
const isCrypto = (pair: string): boolean => /USDT$|USD$/.exec(pair) !== null;

/**
 * Generate fallback mock data when API calls fail
 */
const generateFallbackData = (pair: string): number[] => {
  const basePrice = isCrypto(pair) ? 50000 : 1.1;
  const variance = isCrypto(pair) ? 1000 : 0.1;
  return Array.from({length: 30}, () => basePrice + Math.random() * variance);
};

/**
 * Fetch historical crypto prices from CoinGecko
 */
async function fetchCryptoHistoricalData(pair: string): Promise<number[]> {
  const id = pair.split('/')[0].toLowerCase();
  console.log('Fetching crypto data for:', id);
  
  const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, {
    params: {
      vs_currency: 'usd',
      days: '30',
      interval: 'daily'
    }
  });
  
  if (!response.data?.prices) {
    throw new Error('No price data received from CoinGecko');
  }
  
  return response.data.prices.map((p: [number, number]) => p[1]);
}

/**
 * Fetch historical forex data from Alpha Vantage
 */
async function fetchForexHistoricalData(pair: string): Promise<number[]> {
  console.log('Fetching forex data for:', pair);
  
  const alphaPair = pair.replace('/', '');
  const response = await axios.get('https://www.alphavantage.co/query', {
    params: {
      function: 'FX_DAILY',
      from_symbol: alphaPair.slice(0, 3),
      to_symbol: alphaPair.slice(3),
      apikey: process.env.ALPHA_VANTAGE_API_KEY || '',
      outputsize: 'compact'
    }
  });
  
  if (!response.data?.['Time Series (FX)']) {
    throw new Error('No forex data received from Alpha Vantage');
  }
  
  const timeSeries = response.data['Time Series (FX)'];
  return Object.values(timeSeries)
    .slice(0, 30)
    .map((day: any) => parseFloat(day['4. close']));
}

/**
 * Fetch historical price data for a trading pair
 */
async function fetchHistoricalData(pair: string): Promise<number[]> {
  try {
    return isCrypto(pair) 
      ? await fetchCryptoHistoricalData(pair)
      : await fetchForexHistoricalData(pair);
  } catch (error) {
    console.error('Error in historical data fetch:', error);
    return generateFallbackData(pair);
  }
}

/**
 * Calculate technical indicators from price data
 */
function calculateIndicators(closes: number[]) {
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const smaValues = SMA.calculate({ values: closes, period: 50 });
  const lastClose = closes[closes.length - 1];
  const lastRSI = rsiValues[rsiValues.length - 1] || 50;
  const lastSMA = smaValues[smaValues.length - 1] || lastClose;
  
  return { lastClose, lastRSI, lastSMA };
}

/**
 * Determine signal type based on technical indicators
 */
function determineSignalType(lastClose: number, lastSMA: number, lastRSI: number): 'Buy' | 'Sell' | 'Hold' {
  if (lastClose > lastSMA && lastRSI < 30) return 'Buy';
  if (lastClose < lastSMA && lastRSI > 70) return 'Sell';
  return 'Hold';
}

/**
 * Calculate confidence score based on RSI
 */
const calculateConfidence = (lastRSI: number): number => 
  Math.round(Math.max(0, 100 - Math.abs(50 - lastRSI)));

/**
 * Fetch current price for a trading pair
 */
async function fetchCurrentPrice(pair: string, fallbackPrice: number): Promise<number> {
  try {
    console.log('Fetching current price for:', pair);
    
    if (isCrypto(pair)) {
      const priceData = await getCryptoPrice(pair);
      return priceData.price;
    } else {
      const priceData = await getForexPrice(pair);
      return priceData.price;
    }
  } catch (error) {
    console.error('Error fetching current price:', error);
    return fallbackPrice;
  }
}

/**
 * Generate explanation text for the trading signal
 */
function generateExplanation(
  type: 'Buy' | 'Sell' | 'Hold',
  lastClose: number,
  lastSMA: number,
  lastRSI: number
): string {
  if (type === 'Buy') {
    return `Price ${lastClose.toFixed(2)} > SMA50 ${lastSMA.toFixed(2)} and RSI ${lastRSI.toFixed(0)} < 30 triggered Buy.`;
  }
  
  if (type === 'Sell') {
    return `Price ${lastClose.toFixed(2)} < SMA50 ${lastSMA.toFixed(2)} and RSI ${lastRSI.toFixed(0)} > 70 triggered Sell.`;
  }
  
  return `Conditions not met for Buy/Sell; RSI ${lastRSI.toFixed(0)} is neutral near 50, so Hold.`;
}

/**
 * Fetch news articles with error handling
 */
async function fetchNewsArticles(): Promise<Array<{title: string, url: string}>> {
  try {
    const articles = await getNews();
    return articles.slice(0, 3).map((a: any) => ({ title: a.title, url: a.url }));
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
}

/**
 * Fetches historical close prices and computes a trading signal
 */
export async function calculateSignal(pair: string, timeframe: string = '1d') {
  console.log('Calculating signal for:', pair, 'timeframe:', timeframe);
  
  // Fetch historical data
  const closes = await fetchHistoricalData(pair);
  
  // Calculate technical indicators
  const { lastClose, lastRSI, lastSMA } = calculateIndicators(closes);
  
  // Determine signal type and confidence
  const type = determineSignalType(lastClose, lastSMA, lastRSI);
  const confidence = calculateConfidence(lastRSI);
  
  // Fetch current price for levels
  const price = await fetchCurrentPrice(pair, lastClose);
  
  // Fetch news articles
  const news = await fetchNewsArticles();
  
  // Generate explanation
  const explanation = generateExplanation(type, lastClose, lastSMA, lastRSI);

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
