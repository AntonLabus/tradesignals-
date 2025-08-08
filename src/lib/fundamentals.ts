// fundamentals.ts
import { getNews, getFearGreed, getGlobalCrypto, getMacroNews } from './api';

export interface FundamentalData {
  score: number; // 0-100 fundamental sentiment score
  factors: string[]; // textual factors considered
  news: { title: string; url: string }[];
  sentimentScore?: number; // -1 to 1 aggregate
}

function computeHeadlineSentiment(titles: string[]): { raw: number; normalized: number; descriptor: string } {
  if (!titles.length) return { raw: 0, normalized: 0, descriptor: 'Neutral' };
  const positive = ['gain','gains','surge','bull','bullish','upgrade','beat','growth','strong','rally','optimism','improve','improved','improving','up'];
  const negative = ['loss','lose','losing','drop','drops','bear','bearish','downgrade','fear','weak','selloff','risk','decline','declines','down','concern','concerns'];
  let score = 0;
  titles.forEach(t => {
    const lower = t.toLowerCase();
    positive.forEach(p => { if (lower.includes(p)) score += 1; });
    negative.forEach(n => { if (lower.includes(n)) score -= 1; });
  });
  const normalized = Math.max(-1, Math.min(1, score / (titles.length * 2)));
  let descriptor: string;
  if (normalized > 0.15) descriptor = 'Positive';
  else if (normalized < -0.15) descriptor = 'Negative';
  else descriptor = 'Neutral';
  return { raw: score, normalized, descriptor };
}

let fundamentalsCache: { ts: number; data: Omit<FundamentalData, 'score' | 'factors' | 'news'> & { baseScore: number; articles: any[]; macroNews: any[]; globalCrypto: any; fng: any; sentiment: { normalized: number; descriptor: string } } } | null = null;

// Placeholder economic + fundamental scoring. In real implementation integrate
// economic calendar (rates, CPI, NFP) & company / macro feeds.
export async function fetchFundamentalData(pair: string): Promise<FundamentalData> {
  const baseScore = /USD/.test(pair) ? 60 : 50;
  const now = Date.now();
  const TTL = 5 * 60 * 1000; // 5 minutes
  if (fundamentalsCache && now - fundamentalsCache.ts < TTL) {
    // Reuse cached external data; recompute pair-dependent base adjustment
    try {
      const { articles, macroNews, globalCrypto, fng, sentiment } = fundamentalsCache.data;
      const top = articles.slice(0, 8).map((a: any) => ({ title: a.title, url: a.url }));
      const buzzBoost = Math.min(15, top.length * 1.8);
      const macroBoost = Math.min(10, macroNews.length * 0.8);
      const dominanceAdj = globalCrypto.btcDominance != null ? ((60 - globalCrypto.btcDominance) / 12) : 0;
      const fngAdj = fng.value != null ? (fng.value - 50) / 6 : 0;
      const sentimentAdj = sentiment.normalized * 10;
      const rawScore = baseScore + buzzBoost + macroBoost + dominanceAdj + fngAdj + sentimentAdj;
      const score = Math.max(0, Math.min(100, rawScore));
      return {
        score,
        sentimentScore: sentiment.normalized,
        factors: [
          `Headlines ${top.length}`,
          macroNews.length ? `Macro feeds ${macroNews.length}` : 'Low macro flow',
          fng.value != null ? `Fear & Greed ${fng.value} (${fng.classification})` : 'No FNG',
          globalCrypto.btcDominance != null ? `BTC Dom ${globalCrypto.btcDominance.toFixed(1)}%` : 'No dominance',
          `Sentiment ${sentiment.descriptor}`,
          /USD/.test(pair) ? 'USD macro relevance' : 'Crypto sentiment baseline',
        ],
        news: top,
      };
    } catch (e) {
      console.warn('fundamentals cache reuse failed', e instanceof Error ? e.message : e);
    }
  }
  try {
    const [articles, fng, globalCrypto, macroNews] = await Promise.all([
      withTimeout(getNews(), 2500, () => []),
      withTimeout(getFearGreed(), 2500, () => ({ value: null, classification: null })),
      withTimeout(getGlobalCrypto(), 2500, () => ({ btcDominance: null, activeCryptos: null, marketCapChange24h: null })),
      withTimeout(getMacroNews(), 2500, () => [])
    ]);
    const top = articles.slice(0, 8).map((a: any) => ({ title: a.title, url: a.url }));
    const titles = top.map(t => t.title).filter(Boolean);
    const sentiment = computeHeadlineSentiment(titles as string[]);
    fundamentalsCache = { ts: now, data: { baseScore, articles, macroNews, globalCrypto, fng, sentiment } };
    const sentimentAdj = sentiment.normalized * 10; // scale to -10..+10
    const buzzBoost = Math.min(15, top.length * 1.8);
    const macroBoost = Math.min(10, macroNews.length * 0.8);
    const dominanceAdj = globalCrypto.btcDominance != null ? ((60 - globalCrypto.btcDominance) / 12) : 0; // moderate weighting
    const fngAdj = fng.value != null ? (fng.value - 50) / 6 : 0;
    const rawScore = baseScore + buzzBoost + macroBoost + dominanceAdj + fngAdj + sentimentAdj;
    const score = Math.max(0, Math.min(100, rawScore));
    return {
      score,
      sentimentScore: sentiment.normalized,
      factors: [
        `Headlines ${top.length}`,
        macroNews.length ? `Macro feeds ${macroNews.length}` : 'Low macro flow',
        fng.value != null ? `Fear & Greed ${fng.value} (${fng.classification})` : 'No FNG',
        globalCrypto.btcDominance != null ? `BTC Dom ${globalCrypto.btcDominance.toFixed(1)}%` : 'No dominance',
        `Sentiment ${sentiment.descriptor}`,
        /USD/.test(pair) ? 'USD macro relevance' : 'Crypto sentiment baseline',
      ],
      news: top,
    };
  } catch (e) {
    console.warn('fetchFundamentalData failed', e instanceof Error ? e.message : e);
    return { score: baseScore, factors: ['Fundamental aggregation failed'], news: [] };
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: () => T | Promise<T>): Promise<T> {
  return new Promise<T>((resolve) => {
    const to = setTimeout(async () => {
      try { resolve(await fallback()); } catch { /* ignore */ }
    }, ms);
    p.then(v => { clearTimeout(to); resolve(v); }).catch(() => {
      clearTimeout(to); (async()=>resolve(await fallback()))();
    });
  });
}
