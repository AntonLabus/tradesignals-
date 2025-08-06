import axios from 'axios';
import Parser from 'rss-parser';

export async function getCryptoPrice(pair: string) {
  // Convert pair like 'BTC/USD' to CoinGecko ID 'bitcoin'
  const slug = pair.split('/')[0].toLowerCase();
  const idMap: Record<string, string> = { btc: 'bitcoin', eth: 'ethereum' };
  const id = idMap[slug] ?? slug;
  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: { vs_currency: 'usd', ids: id }
    });
    const data = res.data?.[0];
    if (!data) throw new Error(`No market data for ${id}`);
    return { price: data.current_price };
  } catch (error) {
    console.error('Error fetching crypto price:', error);
    return { price: 0 };
  }
}

export async function getForexPrice(pair: string) {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  console.log('AlphaVantage key present:', !!key, 'for pair:', pair);
  if (!key) {
    console.warn('⚠ Missing ALPHA_VANTAGE_API_KEY, defaulting price to 0');
    return { price: 0 };
  }
  const [from, to] = pair.split('/');
  try {
    const res = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'CURRENCY_EXCHANGE_RATE',
        from_currency: from,
        to_currency: to,
        apikey: key
      }
    });
    const rate = parseFloat(res.data['Realtime Currency Exchange Rate']['5. Exchange Rate']);
    return { price: rate };
  } catch (error) {
    console.error('Error fetching Forex price:', error);
    return { price: 0 };
  }
}

export async function getNews() {
  const parser = new Parser();
  try {
    const feed = await parser.parseURL('https://cryptonews.com/news/feed.rss');
    return feed.items.map(item => ({
      title: item.title,
      url: item.link,
      description: item.contentSnippet ?? item.content ?? '',
      publishedAt: item.pubDate,
    }));
  } catch (error) {
    console.error('Error fetching news RSS feed:', error);
    return [];
  }
}
