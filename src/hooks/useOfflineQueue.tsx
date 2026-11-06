import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from './useOnlineStatus';
import { toast } from 'sonner';
import {
  getOfflineQueue,
  removeFromOfflineQueue,
  updateOperationRetry,
  PendingOperation,
  getQueueCount,
} from '@/lib/offlineQueue';

export function useOfflineQueue() {
  const [pendingCount, setPendingCount] = useState(getQueueCount());
  const [isSyncing, setIsSyncing] = useState(false);
  const isOnline = useOnlineStatus();

  // Listen for queue updates
  useEffect(() => {
    const handleQueueUpdate = (e: CustomEvent) => {
      setPendingCount(e.detail.count);
    };

    window.addEventListener('offlineQueueUpdated', handleQueueUpdate as EventListener);
    return () => {
      window.removeEventListener('offlineQueueUpdated', handleQueueUpdate as EventListener);
    };
  }, []);

  // Process a single operation
  const processOperation = async (op: PendingOperation): Promise<boolean> => {
    try {
      const { type, table, data } = op;

      switch (type) {
        case 'add': {
          const { error } = await supabase.from(table).insert(data);
          if (error) throw error;
          break;
        }
        case 'update': {
          const { id, ...updateData } = data;
          const { error } = await supabase.from(table).update(updateData).eq('id', id);
          if (error) throw error;
          break;
        }
        case 'delete': {
          const { error } = await supabase.from(table).delete().eq('id', data.id);
          if (error) throw error;
          break;
        }
      }

      return true;
    } catch (error) {
      console.error(`Failed to sync operation ${op.id}:`, error);
      return false;
    }
  };

  // Sync all pending operations
  const syncQueue = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    const queue = getOfflineQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    // Process in order (oldest first)
    for (const op of queue) {
      const success = await processOperation(op);

      if (success) {
        removeFromOfflineQueue(op.id);
        successCount++;
      } else {
        const shouldRetry = updateOperationRetry(op.id);
        if (!shouldRetry) {
          failCount++;
        }
      }
    }

    setIsSyncing(false);

    if (successCount > 0) {
      toast.success(`Synced ${successCount} pending change${successCount > 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      toast.error(`Failed to sync ${failCount} item${failCount > 1 ? 's' : ''} after retries`);
    }
  }, [isOnline, isSyncing]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      // Small delay to ensure stable connection
      const timer = setTimeout(() => {
        syncQueue();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, syncQueue]);

  return {
    pendingCount,
    isSyncing,
    syncQueue,
    hasPendingChanges: pendingCount > 0,
  };
}
