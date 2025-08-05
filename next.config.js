/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // swcMinify removed (unsupported in Next.js v15)
  images: {
    domains: ['assets.coingecko.com', 'images.tradingview.com'],
  },
  // If needed, transpile external packages
  // transpilePackages: ['react-tradingview-widget'],
}

module.exports = nextConfig;
