import axios from 'axios';

export async function getCryptoPrice(pair: string) {
  // Convert pair like 'BTC/USD' to CoinGecko ID 'bitcoin'
  const id = pair.split('/')[0].toLowerCase();
  const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
    params: { vs_currency: 'usd', ids: id }
  });
  const data = res.data[0];
  return { price: data.current_price };
}

export async function getForexPrice(pair: string) {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  const [from, to] = pair.split('/');
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
}

export async function getNews() {
  const key = process.env.NEWSAPI_KEY;
  if (key) {
    // Use NewsAPI if key is provided
    const res = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: { category: 'business', apiKey: key }
    });
    return res.data.articles;
  }
  // Fallback to RSS feed via rss2json.com (no API key required)
  const rssRes = await axios.get('https://api.rss2json.com/v1/api.json', {
    params: { rss_url: 'https://cryptonews.com/news/feed.rss' }
  });
  // Map RSS items to a common format
  return rssRes.data.items.map((item: any) => ({
    title: item.title,
    url: item.link,
    description: item.description,
    publishedAt: item.pubDate
  }));
}
