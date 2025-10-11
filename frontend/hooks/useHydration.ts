import { useEffect, useState } from 'react';

/**
 * Custom hook to prevent hydration mismatches
 * Returns true only after the component has hydrated on the client side
 */
export function useHydration() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}
