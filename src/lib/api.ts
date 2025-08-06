import axios from 'axios';
import Parser from 'rss-parser';

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
  const parser = new Parser();
  const feed = await parser.parseURL('https://cryptonews.com/news/feed.rss');
  return feed.items.map(item => ({
    title: item.title,
    url: item.link,
    description: item.contentSnippet ?? item.content ?? '',
    publishedAt: item.pubDate,
  }));
}
