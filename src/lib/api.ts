import axios from 'axios';
import Parser from 'rss-parser';

// Minimal RSS item shape we rely on (avoids implicit any when no @types available)
interface RSSItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  pubDate?: string;
}

// Simple per-URL failure cache to avoid hammering feeds that are returning 403/404/406 for a while
const urlFailCache: Record<string, number> = {};
const URL_FAIL_TTL_MS = 30 * 60 * 1000; // 30 minutes
function markUrlFail(url: string) {
  urlFailCache[url] = Date.now();
}
function shouldSkipUrl(url: string): boolean {
  const ts = urlFailCache[url];
  return !!ts && (Date.now() - ts) < URL_FAIL_TTL_MS;
}

// Shared helper to fetch and parse RSS XML with axios + rss-parser
async function fetchRssFeed(url: string, parser: Parser, headers: Record<string, string>) {
  try {
    const res = await axios.get<string>(url, { timeout: 8000, headers, validateStatus: s => s === 200 });
    const xml = typeof res.data === 'string' ? res.data : '';
    if (!xml) throw new Error('empty XML');
    const feed = await (parser as any).parseString(xml);
    return feed;
  } catch (e) {
    markUrlFail(url);
    throw e;
  }
}

export async function getCryptoPrice(pair: string) {
  // Convert pair like 'BTC/USD' to CoinGecko ID 'bitcoin'
  const [base, quote] = pair.split('/');
  const slug = base.toLowerCase();
  const idMap: Record<string, string> = {
    btc: 'bitcoin', eth: 'ethereum', sol: 'solana', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', ltc: 'litecoin',
    bnb: 'binancecoin', dot: 'polkadot', avax: 'avalanche-2', link: 'chainlink', matic: 'matic-network', trx: 'tron',
    shib: 'shiba-inu', bch: 'bitcoin-cash', xlm: 'stellar', near: 'near', uni: 'uniswap'
  };
  const id = idMap[slug] ?? slug;
  const symbolYahoo = `${base.toUpperCase()}-${(quote || 'USD').toUpperCase()}`;
  const price = await tryFetchers<number>([
    async () => {
      const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
        params: { vs_currency: (quote || 'USD').toLowerCase(), ids: id }
      });
      const data = res.data?.[0];
      const p = Number(data?.current_price);
      return Number.isFinite(p) && p > 0 ? p : null;
    },
    async () => {
      // Yahoo quote as fallback (works for e.g. ETH-USD, BTC-USD)
      const res = await axios.get('https://query1.finance.yahoo.com/v7/finance/quote', { params: { symbols: symbolYahoo } });
      const q = res.data?.quoteResponse?.result?.[0];
      const p = Number(q?.regularMarketPrice ?? q?.bid ?? q?.ask);
      return Number.isFinite(p) && p > 0 ? p : null;
    },
    async () => {
      // CoinGecko simple price fallback
      const res = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: { ids: id, vs_currencies: (quote || 'USD').toLowerCase() }
      });
      const p = Number(res.data?.[id]?.[(quote || 'USD').toLowerCase()]);
      return Number.isFinite(p) && p > 0 ? p : null;
    }
  ]);
  return { price: price ?? 0 };
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
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
  } as const;
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
        if (shouldSkipUrl(url)) return [] as any[];
  const feed = await fetchRssFeed(url, parser, headers as Record<string, string>);
        return feed.items.map((item: RSSItem) => ({
          source: feed.title || url,
          title: item.title,
          url: item.link,
          description: item.contentSnippet ?? item.content ?? '',
          publishedAt: item.pubDate,
        }));
      } catch (e) {
        // Log once when first marked failed; subsequent attempts are skipped for TTL
        if (!shouldSkipUrl(url)) {
          console.warn('Failed RSS feed:', url, e instanceof Error ? e.message : e);
        }
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
  // Basic cache to avoid rate limits (429) and reduce noise
  const now = Date.now();
  const ttl = 10 * 60 * 1000; // 10 minutes
  type GlobalCrypto = { btcDominance: number | null; activeCryptos: number | null; marketCapChange24h: number | null };
  const key = 'coingecko:global';
  const gcAny = (globalThis as any);
  gcAny.__gcCache = gcAny.__gcCache || {} as Record<string, { ts: number; data: GlobalCrypto }>;
  const cache: Record<string, { ts: number; data: GlobalCrypto }> = gcAny.__gcCache;
  const cached = cache[key];
  if (cached && now - cached.ts < ttl) return cached.data;
  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/global', { timeout: 8000 });
    const data = res?.data?.data;
    const out: GlobalCrypto = data ? {
      btcDominance: data.market_cap_percentage?.btc ?? null,
      activeCryptos: data.active_cryptocurrencies ?? null,
      marketCapChange24h: data.market_cap_change_percentage_24h_usd ?? null,
    } : { btcDominance: null, activeCryptos: null, marketCapChange24h: null };
    cache[key] = { ts: now, data: out };
    return out;
  } catch (e) {
    // On failure, return cached value if any without spamming logs
    if (cached) return cached.data;
    console.warn('Global crypto fetch failed', e instanceof Error ? e.message : e);
    return { btcDominance: null, activeCryptos: null, marketCapChange24h: null };
  }
}

// Extend news feeds (only free public RSS)
// Inject extra macro feeds once at runtime; getNews already aggregates, so optionally we could expose a getMacroNews.
export async function getMacroNews() {
  const parser = new Parser();
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
  } as const;
  // Targeted macro sources: FOMC statements, ECB press, US CPI, plus others
  const feeds: { url: string; category: 'FOMC' | 'ECB' | 'CPI' | 'Macro'; source?: string }[] = [
    { url: 'https://www.federalreserve.gov/feeds/press_monetary.xml', category: 'FOMC', source: 'Federal Reserve – Monetary Policy' },
    { url: 'https://www.federalreserve.gov/feeds/press_all.xml', category: 'Macro', source: 'Federal Reserve – All' },
    { url: 'https://www.ecb.europa.eu/press/pressconf/html/index.en.rss', category: 'ECB', source: 'ECB – Press Conferences' },
    { url: 'https://www.ecb.europa.eu/press/rss/press.xml', category: 'ECB', source: 'ECB – Press Releases' },
    { url: 'https://www.bls.gov/feed/news_release/cpi.rss', category: 'CPI', source: 'BLS – CPI News Releases' },
    { url: 'https://www.bankofengland.co.uk/boeapps/rss/feeds.aspx?feed=NewsReleases', category: 'Macro', source: 'Bank of England' },
    { url: 'https://www.imf.org/external/whatshot.rss', category: 'Macro', source: 'IMF' },
  ];
  try {
    const results = await Promise.allSettled(
      feeds.map(async (f) => {
        try {
          if (shouldSkipUrl(f.url)) return [] as any[];
          const feed = await fetchRssFeed(f.url, parser, headers as Record<string, string>);
          return feed.items.map((item: RSSItem) => ({
            title: item.title,
            url: item.link,
            source: f.source || feed.title || f.url,
            category: f.category,
            publishedAt: item.pubDate,
          }));
        } catch (e) {
          if (!shouldSkipUrl(f.url)) {
            console.warn('Failed macro RSS feed:', f.url, e instanceof Error ? e.message : e);
          }
          return [] as any[];
        }
      })
    );
    const aggregated = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
    // Basic dedupe by title
    const seen = new Set<string>();
    const deduped = aggregated.filter((i: any) => {
      if (!i?.title) return false;
      if (seen.has(i.title)) return false;
      seen.add(i.title);
      return true;
    });
    // Sort newest first if dates present
    deduped.sort((a: any, b: any) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
    return deduped.slice(0, 50);
  } catch (e) {
    console.warn('getMacroNews failed', e instanceof Error ? e.message : e);
    return [];
  }
}
