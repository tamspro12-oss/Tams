import { PendingOperation } from '@/lib/offlineQueue';
import { getAuthenticatedAgencyId } from '@/lib/agencyContext';

type TableName = PendingOperation['table'];

// Single source of truth: block mutations when offline instead of faking local saves
export async function executeOrQueue<T>(
  _operation: {
    type: 'add' | 'update' | 'delete';
    table: TableName;
    data: any;
  },
  onlineExecutor: () => Promise<T>,
  isOnline: boolean
): Promise<{ success: boolean; queued: boolean; data?: T; error?: Error }> {
  if (!isOnline) {
    return {
      success: false,
      queued: false,
      error: new Error('You are offline — not saved. Reconnect to the internet and try again.'),
    };
  }
  try {
    const result = await onlineExecutor();
    return { success: true, queued: false, data: result };
  } catch (error) {
    return { success: false, queued: false, error: error as Error };
  }
}

// Get agency ID strictly from authenticated Supabase profile
export async function getCachedAgencyId(): Promise<string | null> {
  try {
    return await getAuthenticatedAgencyId();
  } catch {
    return null;
  }
}
