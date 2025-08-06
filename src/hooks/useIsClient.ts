import { useState, useEffect } from 'react';

/**
 * Custom hook to determine if the component is running on the client side
 * This helps prevent hydration mismatches between server and client rendering
 */
export function useIsClient(): boolean {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}
