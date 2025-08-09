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

// Simplified cache structure storing only external data (pair specific base score recomputed each call)
let fundamentalsCache: { ts: number; articles: any[]; macroNews: any[]; globalCrypto: any; fng: any } | null = null;

// --- Helper functions to reduce cognitive complexity ---
function baseScoreForPair(pair: string): number {
  return /USD/.test(pair) ? 60 : 50;
}

// Lightweight macro tone scoring based on keywords/phrases
function computeMacroTone(items: any[]): { normalized: number; descriptor: string } {
  if (!items?.length) return { normalized: 0, descriptor: 'Neutral' };
  const hawkish = [
    'hawkish', 'hawk', 'higher for longer', 'tighten', 'tightening', 'rate hike', 'hike', 'increase rates',
    'raise rates', 'raising rates', 'hot inflation', 'hotter-than-expected', 'above expectations', 'sticky inflation',
    'reacceleration', 'accelerating inflation', 'surprise increase', 'beats expectations'
  ];
  const dovish = [
    'dovish', 'dove', 'ease', 'easing', 'loosen', 'loosening', 'rate cut', 'cut', 'pause', 'pivot',
    'cool inflation', 'cooler-than-expected', 'disinflation', 'deflation', 'below expectations', 'misses expectations'
  ];
  let hawk = 0; let dove = 0;
  const hasAny = (text: string, list: string[]) => list.some(k => text.includes(k));
  for (const it of items) {
    const t = String(it?.title ?? '').toLowerCase();
    if (!t) continue;
    if (hasAny(t, hawkish)) hawk += 1;
    if (hasAny(t, dovish)) dove += 1;
  }
  const raw = hawk - dove;
  const normalized = clamp(raw / (items.length * 1.5), -1, 1);
  let descriptor = 'Neutral';
  if (normalized > 0.15) descriptor = 'Hawkish';
  else if (normalized < -0.15) descriptor = 'Dovish';
  return { normalized, descriptor };
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// --- New small helpers to reduce complexity inside computeAdjustments ---
function computeBuzzBoost(topCount: number): number {
  return Math.min(15, topCount * 1.8);
}

function weightForMacroCategory(cat: string, pairHasUSD: boolean, pairHasEUR: boolean): number {
  const C = cat.toUpperCase();
  if (C.includes('FOMC')) return pairHasUSD ? 3 : 1;
  if (C.includes('ECB')) return pairHasEUR ? 3 : 1;
  if (C.includes('CPI')) return pairHasUSD ? 2.5 : 1;
  return 0.5; // generic macro
}

function computeMacroBoostValue(macroNews: any[], pairHasUSD: boolean, pairHasEUR: boolean): number {
  const sum = macroNews.reduce((acc, m) => acc + weightForMacroCategory(m.category || '', pairHasUSD, pairHasEUR), 0);
  return Math.min(18, sum);
}

function makeFactors(ctx: { topLen: number; macroLen: number; macroBoost: number; fng: any; globalCrypto: any; sentimentDesc: string; macroToneDesc: string; pair: string }): string[] {
  const usdRelevant = /USD/.test(ctx.pair);
  return [
    `Headlines ${ctx.topLen}`,
    ctx.macroLen ? `Macro events ${ctx.macroLen} (weighted ${ctx.macroBoost.toFixed(1)})` : 'Low macro flow',
    ctx.fng?.value != null ? `Fear & Greed ${ctx.fng.value} (${ctx.fng.classification})` : 'No FNG',
    ctx.globalCrypto?.btcDominance != null ? `BTC Dom ${ctx.globalCrypto.btcDominance.toFixed(1)}%` : 'No dominance',
    `Sentiment ${ctx.sentimentDesc ?? 'Neutral'}`,
    `Macro tone ${ctx.macroToneDesc}`,
    usdRelevant ? 'USD macro relevance' : 'Crypto sentiment baseline',
  ];
}

function selectMacroTop(macroNews: any[], n = 5): { title: string; url: string }[] {
  return macroNews.slice(0, n).map((m: any) => ({ title: (m.title || m.source || 'Macro'), url: m.url || '#' }));
}

function computeAdjustments(baseScore: number, pair: string, articles: any[], macroNews: any[], globalCrypto: any, fng: any, sentiment: { normalized: number; descriptor: string }) {
  const top = articles.slice(0, 8).map((a: any) => ({ title: a.title, url: a.url }));
  const buzzBoost = computeBuzzBoost(top.length);
  const pairHasUSD = /USD/.test(pair);
  const pairHasEUR = /EUR/.test(pair);
  const macroBoost = computeMacroBoostValue(macroNews, pairHasUSD, pairHasEUR);
  // Macro tone adjustment (small), independent of pair, derived from headlines
  const macroTone = computeMacroTone(macroNews);
  const macroToneAdj = (macroTone.normalized || 0) * 6; // small tilt
  const dominanceAdj = globalCrypto?.btcDominance != null ? ((60 - globalCrypto.btcDominance) / 12) : 0;
  const fngAdj = fng?.value != null ? (fng.value - 50) / 6 : 0;
  const sentimentAdj = (sentiment?.normalized ?? 0) * 10;
  const rawScore = baseScore + buzzBoost + macroBoost + macroToneAdj + dominanceAdj + fngAdj + sentimentAdj;
  const score = Math.max(0, Math.min(100, rawScore));
  const factors = makeFactors({
    topLen: top.length,
    macroLen: macroNews.length,
    macroBoost,
    fng,
    globalCrypto,
    sentimentDesc: sentiment?.descriptor,
    macroToneDesc: macroTone.descriptor,
    pair,
  });
  // Surface a few macro items into news to provide context
  const macroTop = selectMacroTop(macroNews, 5);
  return { score, factors, news: [...macroTop, ...top].slice(0, 10), sentimentScore: sentiment?.normalized ?? 0 };
}

function buildResult(baseScore: number, pair: string, cacheData: { articles: any[]; macroNews: any[]; globalCrypto: any; fng: any; sentiment: { normalized: number; descriptor: string } }): FundamentalData {
  return computeAdjustments(baseScore, pair, cacheData.articles, cacheData.macroNews, cacheData.globalCrypto, cacheData.fng, cacheData.sentiment);
}

async function fetchExternalData(now: number): Promise<{ articles: any[]; macroNews: any[]; globalCrypto: any; fng: any }> {
  const [articles, fng, globalCrypto, macroNews] = await Promise.all([
    withTimeout(getNews(), 2500, () => []),
    withTimeout(getFearGreed(), 2500, () => ({ value: null, classification: null })),
    withTimeout(getGlobalCrypto(), 2500, () => ({ btcDominance: null, activeCryptos: null, marketCapChange24h: null })),
    withTimeout(getMacroNews(), 2500, () => [])
  ]);
  fundamentalsCache = { ts: now, articles, macroNews, globalCrypto, fng };
  return { articles, macroNews, globalCrypto, fng };
}

function computePairAwareSentiment(pair: string, articles: any[]): { normalized: number; descriptor: string } {
  const [base, quote] = pair.split('/');
  const boostTerms = [base.toUpperCase(), quote.toUpperCase(), base.toLowerCase(), quote.toLowerCase()];
  const boosted = articles.map(a => {
    const t = a.title || '';
    const boost = boostTerms.some(term => t.includes(term)) ? 0.2 : 0;
    return { ...a, boost };
  });
  const titles = boosted.map(a => a.title);
  const sent = computeHeadlineSentiment(titles);
  return { normalized: Math.max(-1, Math.min(1, sent.normalized + boosted.filter(b => b.boost > 0).length * 0.01)), descriptor: sent.descriptor };
}

// Placeholder economic + fundamental scoring. In real implementation integrate
// economic calendar (rates, CPI, NFP) & company / macro feeds.
export async function fetchFundamentalData(pair: string, timeframe: string = '1H'): Promise<FundamentalData> {
  const now = Date.now();
  const baseScore = baseScoreForPair(pair);
  // Fresher fundamentals for intraday; longer for daily
  const TTL = timeframe === '1D' ? 15 * 60 * 1000 : 2 * 60 * 1000;

  // Try cache
  if (fundamentalsCache && now - fundamentalsCache.ts < TTL) {
    try {
  const sentiment = computePairAwareSentiment(pair, fundamentalsCache.articles);
  return computeAdjustments(baseScore, pair, fundamentalsCache.articles, fundamentalsCache.macroNews, fundamentalsCache.globalCrypto, fundamentalsCache.fng, sentiment);
    } catch (e) {
      console.warn('fundamentals cache reuse failed', e instanceof Error ? e.message : e);
    }
  }

  // Fetch fresh external data
  try {
    const ext = await fetchExternalData(now);
    const sentiment = computePairAwareSentiment(pair, ext.articles);
    // Cache already set inside fetchExternalData; compute per-pair result
    return computeAdjustments(baseScore, pair, ext.articles, ext.macroNews, ext.globalCrypto, ext.fng, sentiment);
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
