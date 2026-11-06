import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { preloadEssentialData } from '@/lib/dataPreloader';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface SyncContextType {
  status: SyncStatus;
  lastSyncTime: Date | null;
  isOnline: boolean;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const queryClient = useQueryClient();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setStatus('idle');
      // Auto-sync when coming back online
      triggerSync();
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Silent background auto-refresh every 30 seconds on mobile
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;

    const interval = setInterval(() => {
      if (isOnline && status === 'idle') {
        queryClient.invalidateQueries();
        setLastSyncTime(new Date());
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline, status, queryClient]);

  const triggerSync = useCallback(async () => {
    if (!isOnline) {
      setStatus('offline');
      return;
    }

    setStatus('syncing');
    
    try {
      // Invalidate all queries to force fresh fetch
      await queryClient.invalidateQueries();
      
      // Preload essential data
      await preloadEssentialData(queryClient);
      
      setStatus('synced');
      setLastSyncTime(new Date());
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Sync failed:', error);
      setStatus('error');
      
      // Reset to idle after 5 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 5000);
    }
  }, [queryClient, isOnline]);

  return (
    <SyncContext.Provider value={{ status, lastSyncTime, isOnline, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
