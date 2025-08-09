# TradeSignals

A multi-page trading signal website for Forex and Crypto built with Next.js, TypeScript, and Tailwind CSS.

## Features
- Home page with overview of signal generation methodology.
- Signals Dashboard listing active signals for Forex and Crypto pairs.
- Detailed signal pages with chart, confidence score, recommended levels, and explanation.
- Multi-timeframe support (1m, 5m, 15m, 30m, 1H, 4H, 1D).
- Light/Dark mode toggle and mobile-responsive design.

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm run start
```

### Lint

```bash
npm run lint
```

## Project Structure

- `src/app/layout.tsx` - Root layout with navigation and global styles.
- `src/app/page.tsx` - Home page.
- `src/app/signals/page.tsx` - Signals dashboard.
- `src/app/signals/[pair]/page.tsx` - Detailed signal breakdown.
- `tailwind.config.js`, `postcss.config.js` - Tailwind CSS setup.

## Deployment

This project is configured for deployment on Netlify. Ensure the build command is `npm run build` and the publish directory is `.next`.

## Configuration

- LIVE_PRICE_ANCHOR_RATIO (or NEXT_PUBLIC_LIVE_PRICE_ANCHOR_RATIO):
	Controls when to re-anchor computed SL/TP levels to the current live price.
	If the ratio between current price and last close exceeds this value, levels are re-anchored.
	Default: `1.2` (20% difference). Must be greater than `1.0`.

- LIVE_PRICE_ANCHOR_ATR_MULTIPLIER (or NEXT_PUBLIC_LIVE_PRICE_ANCHOR_ATR_MULTIPLIER):
	Also re-anchors if absolute diff exceeds this multiple of ATR (or volatility when ATR missing).
	Default: `5` (5x ATR).

- LIVE_PRICE_ANCHOR_FX_PIPS (or NEXT_PUBLIC_LIVE_PRICE_ANCHOR_FX_PIPS):
	For Forex only, re-anchors if absolute diff exceeds this pip distance (50 pips by default).
	JPY pairs use pip size of 0.01; others 0.0001.

	## Data Sources

	- Crypto: CoinGecko (prices, historical)
	- Forex: Alpha Vantage, Yahoo Finance, exchangerate.host, Frankfurter, ER-API
	- News: CryptoNews, CoinDesk, WSJ Markets, ECB press
	- Macro: Federal Reserve (FOMC statements), ECB press releases, US BLS CPI releases, Bank of England, IMF
