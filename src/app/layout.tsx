import './globals.css';
import React, { ReactNode } from 'react';
import Link from 'next/link';
import NextThemesProvider from '../components/ThemeProvider';

export const metadata = {
  title: 'TradeSignals',
  description: 'Forex & Crypto trading signals dashboard',
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <NextThemesProvider>
          <header className="border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold">
              <Link href="/">TradeSignals</Link>
            </h1>
            <nav className="flex items-center">
              <Link href="/" className="mr-4">Home</Link>
              <Link href="/signals">Signals</Link>
            </nav>
          </header>
          <main className="p-6 max-w-5xl mx-auto">{children}</main>
        </NextThemesProvider>
      </body>
    </html>
  );
}
