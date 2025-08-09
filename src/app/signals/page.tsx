import TimeframeSelectorClient from '../../components/TimeframeSelectorClient';
import { Metadata } from 'next';
import React from 'react';
import ClientLayout from './ClientLayout';

export const metadata: Metadata = {
  title: 'Signals · TradeSignals',
  description: 'Current active trading signals for Forex and Crypto pairs',
};

export const dynamic = 'force-dynamic';

// Server component page; client composition moved to ClientLayout
export default function SignalsPage() {
  return (
    <div className="space-y-6">
      <TimeframeSelectorClient
        value=""
        onChange={() => {}}
      />
      <h1 className="text-3xl font-bold tracking-tight">Active Signals</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-6">
        {/* Sidebar + Table compose in a client wrapper */}
        <ClientLayout />
      </div>
    </div>
  );
}
