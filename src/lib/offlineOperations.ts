import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { addToOfflineQueue, PendingOperation } from '@/lib/offlineQueue';
import { supabase } from '@/integrations/supabase/client';

type TableName = PendingOperation['table'];

// Helper to check if online and queue operation if offline
export async function executeOrQueue<T>(
  operation: {
    type: 'add' | 'update' | 'delete';
    table: TableName;
    data: any;
  },
  onlineExecutor: () => Promise<T>,
  isOnline: boolean
): Promise<{ success: boolean; queued: boolean; data?: T; error?: Error }> {
  if (isOnline) {
    try {
      const result = await onlineExecutor();
      return { success: true, queued: false, data: result };
    } catch (error) {
      // If online execution fails, don't queue - just return error
      return { success: false, queued: false, error: error as Error };
    }
  } else {
    // Queue for later sync
    addToOfflineQueue(operation);
    return { success: true, queued: true };
  }
}

import { getAuthenticatedAgencyId } from '@/lib/agencyContext';

// Get agency ID for offline operations
export async function getCachedAgencyId(): Promise<string | null> {
  try {
    const cached = localStorage.getItem('tams_agency_id');
    if (cached) return cached;

    return await getAuthenticatedAgencyId();
  } catch {
    return localStorage.getItem('tams_agency_id');
  }
}
