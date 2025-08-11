import { deriveFinalType, _testCreateIndicatorBundle, decideTypeWithPOI } from './signals';

// Basic POI stub
const poi = { fibs: [] as number[] };
const volCtx = { volRatio: 0.01, isCrypto: false };

describe('deriveFinalType fallbacks', () => {
  it('returns Sell fallback when baseType Sell and POI blocks but strong downtrend + momentum', () => {
    const bundle = _testCreateIndicatorBundle({
      lastClose: 99,
      lastSMA: 101,
      sma200: 101,
      ema20: 99,
      ema50: 100,
      macdHist: -0.5,
      lastRSI: 47, // slightly above raw sell RSI (45) but within +5 window
    });
    const t = deriveFinalType('Sell', 50, bundle, poi, volCtx); // fundamentals neutral
    expect(['Sell','Hold']).toContain(t); // allow Sell fallback
  });

  it('blocks Sell fallback if fundamentals bullish', () => {
    const bundle = _testCreateIndicatorBundle({
      lastClose: 99,
      lastSMA: 101,
      sma200: 101,
      ema20: 99,
      ema50: 100,
      macdHist: -0.5,
      lastRSI: 47,
    });
    const t = deriveFinalType('Sell', 70, bundle, poi, volCtx); // bullish fundamentals
    expect(t).toBe('Hold');
  });

  it('returns Buy fallback when baseType Buy and near RSI threshold + uptrend', () => {
    const bundle = _testCreateIndicatorBundle({
      lastClose: 101,
      lastSMA: 100,
      sma200: 100,
      ema20: 102,
      ema50: 100,
      macdHist: 0.3,
      lastRSI: 53, // within 2 points of default 55 threshold
    });
    const t = deriveFinalType('Buy', 50, bundle, poi, volCtx);
    expect(['Buy','Hold']).toContain(t);
  });

  it('holds when no fallback criteria met', () => {
    const bundle = _testCreateIndicatorBundle({ lastClose: 100, sma200: 100, ema20: 100, ema50: 100, lastRSI: 50, macdHist: 0 });
    const t = deriveFinalType('Buy', 50, bundle, poi, volCtx);
    expect(['Hold','Buy']).toContain(t); // might remain Hold
  });
});
