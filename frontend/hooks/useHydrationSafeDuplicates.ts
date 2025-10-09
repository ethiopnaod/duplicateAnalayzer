import { useEffect, useState } from 'react';
import { useDuplicates } from './useDuplicates';

/**
 * Hydration-safe wrapper for useDuplicates hook
 * Prevents SSR/hydration mismatches by only fetching data after hydration
 */
export function useHydrationSafeDuplicates(options: Parameters<typeof useDuplicates>[0]) {
  const [isHydrated, setIsHydrated] = useState(false);
  const duplicates = useDuplicates(options);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Return empty state during SSR, actual data after hydration
  if (!isHydrated) {
    return {
      ...duplicates,
      entities: [],
      totalCount: 0,
      isLoading: true,
      isProcessing: false,
    };
  }

  return duplicates;
}
