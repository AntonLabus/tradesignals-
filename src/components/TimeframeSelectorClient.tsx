"use client";
import { useRouter, useSearchParams } from 'next/navigation';
import TimeframeSelector from './TimeframeSelector';

export default function TimeframeSelectorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (tf: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    params.set('timeframe', tf);
    // preserve other params
    router.push(`?${params.toString()}`);
  };

  return <TimeframeSelector onChange={handleChange} />;
}
