import { useState, useEffect } from 'react';

/**
 * Hook to safely manage state that might cause hydration mismatches
 * Only updates state after the component has mounted on the client
 */
export function useHydrationSafeState<T>(initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return [isHydrated ? state : initialValue, setState, isHydrated] as const;
}

/**
 * Hook to safely access browser-only APIs
 * Returns null during SSR and the actual value after hydration
 */
export function useClientOnly<T>(getValue: () => T, fallback: T | null = null) {
  const [value, setValue] = useState<T | null>(fallback);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    setValue(getValue());
  }, [getValue]);

  return isClient ? value : fallback;
}
