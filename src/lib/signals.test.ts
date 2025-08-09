import { computeLevels, decideTypeWithPOI } from './signals';

describe('decideTypeWithPOI', () => {
  const base = {
    lastClose: 100,
    atr: 1,
    vol: 0.5,
    isCrypto: false,
  };

  it('returns Hold when no POIs and neutral biases', () => {
    const type = decideTypeWithPOI('Hold', 50, base.lastClose, base.atr, base.vol, base.isCrypto, { fibs: [] });
    expect(type).toBe('Hold');
  });

  it('favors Buy when tech bull near demand and fundamentals not bearish', () => {
    const type = decideTypeWithPOI(
      'Buy',
      60, // bull fundamentals
      base.lastClose,
      base.atr,
      base.vol,
      base.isCrypto,
      { demandZone: { low: 99.5, high: 100.5 }, fibs: [] }
    );
    expect(type).toBe('Buy');
  });

  it('favors Sell when tech bear near supply and fundamentals not bullish', () => {
    const type = decideTypeWithPOI(
      'Sell',
      40, // bear fundamentals
      base.lastClose,
      base.atr,
      base.vol,
      base.isCrypto,
      { supplyZone: { low: 99.5, high: 100.5 }, fibs: [] }
    );
    expect(type).toBe('Sell');
  });

  it('allows Buy/Sell when near fib even if zones missing', () => {
    const buy = decideTypeWithPOI('Buy', 55, 100, 1, 0.2, false, { fibs: [100] });
    const sell = decideTypeWithPOI('Sell', 45, 100, 1, 0.2, false, { fibs: [100] });
    expect(['Buy','Hold']).toContain(buy);
    expect(['Sell','Hold']).toContain(sell);
  });

  it('blocks Buy if fundamentals strongly bearish', () => {
    const type = decideTypeWithPOI('Buy', 10, 100, 1, 0.2, false, { demandZone: { low: 99.5, high: 100.5 }, fibs: [] });
    expect(type).toBe('Hold');
  });

  it('blocks Sell if fundamentals strongly bullish', () => {
    const type = decideTypeWithPOI('Sell', 90, 100, 1, 0.2, false, { supplyZone: { low: 99.5, high: 100.5 }, fibs: [] });
    expect(type).toBe('Hold');
  });
});

describe('computeLevels', () => {
  it('computes Buy levels with default RR and ATR stop', () => {
    const levels = computeLevels('Buy', 100, 2, 0.5, false, {});
    expect(levels.entry).toBe(100);
    expect(levels.sl).toBeLessThan(100);
    expect(levels.tp).toBeGreaterThan(100);
    expect(levels.tp - 100).toBeCloseTo((100 - levels.sl) * 2, 5);
  });

  it('computes Sell levels mirrored', () => {
    const levels = computeLevels('Sell', 100, 2, 0.5, false, {});
    expect(levels.entry).toBe(100);
    expect(levels.sl).toBeGreaterThan(100);
    expect(levels.tp).toBeLessThan(100);
    expect(100 - levels.tp).toBeCloseTo((levels.sl - 100) * 2, 5);
  });

  it('respects demand/supply zones when present', () => {
    const buy = computeLevels('Buy', 100, 1, 0.2, false, { demandZone: { low: 98.9, high: 99.1 }, supplyZone: { low: 101, high: 102 } });
    const sell = computeLevels('Sell', 100, 1, 0.2, false, { demandZone: { low: 98.9, high: 99.1 }, supplyZone: { low: 101, high: 102 } });
    expect(buy.sl).toBeLessThanOrEqual(98.9);
    expect(buy.tp).toBeGreaterThanOrEqual(102);
    expect(sell.sl).toBeGreaterThanOrEqual(102);
    expect(sell.tp).toBeLessThanOrEqual(98.9);
  });

  it('uses percentage-based stop when ATR missing (forex)', () => {
    const levels = computeLevels('Buy', 1.2, undefined, 0.01, false, {});
    // ~0.3% of price for forex path
    expect(1.2 - levels.sl).toBeCloseTo(1.2 * 0.003, 5);
  });

  it('uses wider percentage when ATR missing (crypto)', () => {
    const levels = computeLevels('Buy', 50000, undefined, 50, true, {});
    // ~1% of price for crypto path
    expect(50000 - levels.sl).toBeCloseTo(50000 * 0.01, 2);
  });
});

describe('parametrized decideTypeWithPOI', () => {
  type Case = {
    name: string;
    tech: 'Buy' | 'Sell' | 'Hold';
    fund: number;
    lastClose: number;
    atr?: number;
    vol: number;
    isCrypto: boolean;
    demand?: { low: number; high: number };
    supply?: { low: number; high: number };
    fibs?: number[];
    expected: 'Buy' | 'Sell' | 'Hold';
  };
  const cases: Case[] = [
    {
      name: 'Buy near demand; fundamentals neutral → Buy',
      tech: 'Buy', fund: 50, lastClose: 100, atr: 1, vol: 0.2, isCrypto: false,
      demand: { low: 99.7, high: 100.3 }, expected: 'Buy'
    },
    {
      name: 'Buy near fib; fundamentals neutral → Buy',
      tech: 'Buy', fund: 50, lastClose: 100, atr: 1, vol: 0.2, isCrypto: false,
      fibs: [100], expected: 'Buy'
    },
    {
      name: 'Buy near demand; fundamentals bearish → Hold (blocked)',
      tech: 'Buy', fund: 40, lastClose: 100, atr: 1, vol: 0.2, isCrypto: false,
      demand: { low: 99.7, high: 100.3 }, expected: 'Hold'
    },
    {
      name: 'Sell near supply; fundamentals bearish → Sell',
      tech: 'Sell', fund: 40, lastClose: 100, atr: 1, vol: 0.2, isCrypto: false,
      supply: { low: 99.7, high: 100.3 }, expected: 'Sell'
    },
    {
      name: 'Sell near fib; fundamentals neutral → Sell',
      tech: 'Sell', fund: 50, lastClose: 100, atr: 1, vol: 0.2, isCrypto: false,
      fibs: [100], expected: 'Sell'
    },
    {
      name: 'Sell near supply; fundamentals bullish → Hold (blocked)',
      tech: 'Sell', fund: 70, lastClose: 100, atr: 1, vol: 0.2, isCrypto: false,
      supply: { low: 99.7, high: 100.3 }, expected: 'Hold'
    },
    {
      name: 'Tech Hold near demand; fundamentals bullish → Hold',
      tech: 'Hold', fund: 70, lastClose: 100, atr: 1, vol: 0.2, isCrypto: false,
      demand: { low: 99.7, high: 100.3 }, expected: 'Hold'
    },
    {
      name: 'Crypto, no ATR, inside demand; tech Buy, fund neutral → Buy',
      tech: 'Buy', fund: 55, lastClose: 25000, vol: 100, isCrypto: true,
      demand: { low: 24980, high: 25020 }, expected: 'Buy'
    },
  ];
  it.each(cases)('%s', (c) => {
    const got = decideTypeWithPOI(
      c.tech, c.fund, c.lastClose, c.atr, c.vol, c.isCrypto,
      { demandZone: c.demand, supplyZone: c.supply, fibs: c.fibs ?? [] }
    );
    expect(got).toBe(c.expected);
  });
});

describe('parametrized computeLevels', () => {
  type LCase = {
    name: string;
    type: 'Buy' | 'Sell';
    price: number;
    atr?: number;
    vol: number;
    isCrypto: boolean;
  };
  const levelCases: LCase[] = [
    { name: 'Buy with ATR', type: 'Buy', price: 100, atr: 1.5, vol: 0.3, isCrypto: false },
    { name: 'Sell with ATR', type: 'Sell', price: 100, atr: 1.5, vol: 0.3, isCrypto: false },
    { name: 'Buy forex no ATR', type: 'Buy', price: 1.25, vol: 0.01, isCrypto: false },
    { name: 'Buy crypto no ATR', type: 'Buy', price: 35000, vol: 30, isCrypto: true },
  ];
  it.each(levelCases)('%s', (c) => {
    const levels = computeLevels(c.type, c.price, c.atr, c.vol, c.isCrypto, {});
    expect(levels.entry).toBeCloseTo(c.price, 8);
    if (c.type === 'Buy') {
      expect(levels.sl).toBeLessThan(c.price);
      expect(levels.tp).toBeGreaterThan(c.price);
    } else {
      expect(levels.sl).toBeGreaterThan(c.price);
      expect(levels.tp).toBeLessThan(c.price);
    }
  });
});
