export const ALLOWED_TIMEFRAMES = ['1m','5m','15m','30m','1H','4H','1D'] as const;
export type Timeframe = typeof ALLOWED_TIMEFRAMES[number];

export function sanitizeTimeframe(tf: string | null | undefined, fallback: Timeframe = '30m'): Timeframe {
  if (!tf) return fallback;
  const v = String(tf);
  return (ALLOWED_TIMEFRAMES as readonly string[]).includes(v) ? (v as Timeframe) : fallback;
}

export function getDefaultTimeframe(): Timeframe {
  const env = (process.env.NEXT_PUBLIC_DEFAULT_TIMEFRAME || '').trim();
  return sanitizeTimeframe(env || '30m', '30m');
}
