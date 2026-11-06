import { QueryClient } from '@tanstack/react-query';
import { cloudStorage } from '@/lib/storage/cloudStorageProvider';

/**
 * Preload essential data in the background after authentication.
 * Fire-and-forget — never blocks the UI thread or throws.
 */
export function preloadEssentialData(queryClient: QueryClient): void {
  const run = () => {
    const prefetch = (key: string, fn: () => Promise<any>) =>
      queryClient
        .prefetchQuery({ queryKey: [key], queryFn: fn, staleTime: 5 * 60 * 1000 })
        .catch(() => {});

    prefetch('clients', () => cloudStorage.getClients());
    prefetch('vendors', () => cloudStorage.getVendors());
    prefetch('expenses', () => cloudStorage.getExpenses());
    prefetch('queries', () => cloudStorage.getQueries());
  };

  if (typeof (window as any).requestIdleCallback === 'function') {
    (window as any).requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 0);
  }
}

