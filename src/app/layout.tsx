import './globals.css';
import React, { ReactNode } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import Background3D from '../components/Background3D';
import NextThemesProvider from '../components/ThemeProvider';
import ThemeToggle from '../components/ThemeToggle';

export const metadata: Metadata = {
  title: 'TradeSignals',
  description: 'Trading signals for Forex and Crypto',
  icons: { icon: '/favicon.ico' }
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="min-h-screen text-slate-900 dark:text-slate-100">
        <NextThemesProvider>
          <Background3D />
          <header className="sticky top-0 z-40 header-gradient/30 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:supports-[backdrop-filter]:bg-white/5">
            <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-neon-cyan shadow-neon animate-glow" />
                <Link href="/" className="text-lg md:text-2xl font-bold tracking-tight">TradeSignals</Link>
              </div>
              <nav className="flex items-center gap-6 text-sm">
                <Link href="/" className="hover:text-neon-cyan">Home</Link>
                <Link href="/signals" className="hover:text-neon-violet">Signals</Link>
                <ThemeToggle />
              </nav>
            </div>
            <div className="neon-divider" />
          </header>
          <main className="relative max-w-6xl mx-auto px-6 py-8 space-y-6">{children}</main>
        </NextThemesProvider>
      </body>
    </html>
  );
}
