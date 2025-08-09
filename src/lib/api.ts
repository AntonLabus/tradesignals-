import axios from 'axios';
import Parser from 'rss-parser';

export async function getCryptoPrice(pair: string) {
  // Convert pair like 'BTC/USD' to CoinGecko ID 'bitcoin'
  const slug = pair.split('/')[0].toLowerCase();
  const idMap: Record<string, string> = {
    btc: 'bitcoin', eth: 'ethereum', sol: 'solana', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', ltc: 'litecoin',
    bnb: 'binancecoin', dot: 'polkadot', avax: 'avalanche-2', link: 'chainlink', matic: 'matic-network', trx: 'tron',
    shib: 'shiba-inu', bch: 'bitcoin-cash', xlm: 'stellar', near: 'near', uni: 'uniswap'
  };
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

export async function getFearGreed() {
  try {
    const res = await axios.get('https://api.alternative.me/fng/?limit=1&format=json');
    const v = res.data?.data?.[0];
    if (!v) return { value: null, classification: null };
    return { value: parseInt(v.value, 10), classification: v.value_classification };
  } catch (e) {
    console.warn('Fear & Greed fetch failed', e instanceof Error ? e.message : e);
    return { value: null, classification: null };
  }
}

async function tryFetchers<T>(fns: Array<() => Promise<T | null>>): Promise<T | null> {
  for (const fn of fns) {
    try {
      const v = await fn();
      if (v != null) return v;
    } catch {
      // continue
    }
  }
  return null;
}

export async function getForexPrice(pair: string) {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  const [from, to] = pair.split('/');

  const result = await tryFetchers<number>([
    async () => {
      if (!key) return null;
      const res = await axios.get('https://www.alphavantage.co/query', {
        params: { function: 'CURRENCY_EXCHANGE_RATE', from_currency: from, to_currency: to, apikey: key }
      });
      const rate = parseFloat(res.data?.['Realtime Currency Exchange Rate']?.['5. Exchange Rate']);
      return Number.isFinite(rate) && rate > 0 ? rate : null;
    },
    async () => {
      const symbol = `${from}${to}=X`;
      const res = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', { params: { symbols: symbol } });
      const q = res.data?.quoteResponse?.result?.[0];
      const rate = Number(q?.regularMarketPrice ?? q?.bid ?? q?.ask);
      return Number.isFinite(rate) && rate > 0 ? rate : null;
    },
    async () => {
      const fx = await axios.get('https://api.exchangerate.host/latest', { params: { base: from, symbols: to } });
      const rate = Number(fx.data?.rates?.[to]);
      return Number.isFinite(rate) && rate > 0 ? rate : null;
    },
    async () => {
      const res = await axios.get('https://api.frankfurter.app/latest', { params: { from, to } });
      const rate = Number(res.data?.rates?.[to]);
      return Number.isFinite(rate) && rate > 0 ? rate : null;
    },
    async () => {
      const res = await axios.get(`https://open.er-api.com/v6/latest/${from}`);
      const rate = Number(res.data?.rates?.[to]);
      return Number.isFinite(rate) && rate > 0 ? rate : null;
    }
  ]);

  if (result != null) return { price: result };
  return { price: 0 };
}

export async function getNews() {
  const parser = new Parser();
  // Collection of free RSS feeds (crypto + macro/markets)
  const feeds = [
    'https://cryptonews.com/news/feed.rss', // crypto
    'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml', // crypto
    'https://feeds.a.dj.com/rss/RSSMarketsMain.xml', // WSJ Markets (headlines)
    'https://www.ecb.europa.eu/press/pressconf/html/index.en.rss', // ECB press conf / policy
  ];

  // Each feed handled individually; Promise.allSettled ensures overall function does not throw.
  const results = await Promise.allSettled(
    feeds.map(async (url) => {
      try {
        const feed = await parser.parseURL(url);
        return feed.items.map(item => ({
          source: feed.title || url,
          title: item.title,
          url: item.link,
          description: item.contentSnippet ?? item.content ?? '',
          publishedAt: item.pubDate,
        }));
      } catch (e) {
        console.warn('Failed RSS feed:', url, e instanceof Error ? e.message : e);
        return [] as any[];
      }
    })
  );
  // Flatten fulfilled
  const aggregated = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  // Dedupe by title
  const seen = new Set<string>();
  const deduped = aggregated.filter(item => {
    if (!item.title) return false;
    if (seen.has(item.title)) return false;
    seen.add(item.title);
    return true;
  });
  // Sort by date desc if possible
  deduped.sort((a, b) => (new Date(b.publishedAt || 0).getTime()) - (new Date(a.publishedAt || 0).getTime()));
  return deduped.slice(0, 25); // limit
}

export async function getGlobalCrypto() {
  // Narrow error handling: only catch the HTTP request; if it fails, return explicit fallback.
  const res = await axios.get('https://api.coingecko.com/api/v3/global').catch(e => {
    console.warn('Global crypto fetch failed', e instanceof Error ? e.message : e);
    return null;
  });
  const data = res?.data?.data;
  if (!data) {
    return { btcDominance: null, activeCryptos: null, marketCapChange24h: null };
  }
  return {
    btcDominance: data.market_cap_percentage?.btc ?? null,
    activeCryptos: data.active_cryptocurrencies ?? null,
    marketCapChange24h: data.market_cap_change_percentage_24h_usd ?? null,
  };
}

// Extend news feeds (only free public RSS)
// Inject extra macro feeds once at runtime; getNews already aggregates, so optionally we could expose a getMacroNews.
export async function getMacroNews() {
  const parser = new Parser();
  const feeds = [
    'https://www.federalreserve.gov/feeds/press_all.xml',
    'https://www.bankofengland.co.uk/boeapps/rss/feeds.aspx?feed=NewsReleases',
    'https://www.imf.org/external/whatshot.rss',
  ];
  try {
    const results = await Promise.allSettled(feeds.map(f => parser.parseURL(f)));
    return results.flatMap(r => r.status === 'fulfilled' ? r.value.items.map(i => ({ title: i.title, url: i.link })) : []);
  } catch {
    return [];
  }
}
