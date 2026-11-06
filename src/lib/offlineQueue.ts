// Offline Queue Manager - stores pending operations locally and syncs when online

export interface PendingOperation {
  id: string;
  type: 'add' | 'update' | 'delete';
  table: 'clients' | 'bookings' | 'vendors' | 'expenses' | 'queries';
  data: any;
  timestamp: number;
  retryCount: number;
}

const QUEUE_KEY = 'tams_offline_queue';
const MAX_RETRIES = 3;

export function getOfflineQueue(): PendingOperation[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): void {
  const queue = getOfflineQueue();
  const newOp: PendingOperation = {
    ...operation,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retryCount: 0,
  };
  queue.push(newOp);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  
  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent('offlineQueueUpdated', { detail: { count: queue.length } }));
}

export function removeFromOfflineQueue(operationId: string): void {
  const queue = getOfflineQueue();
  const filtered = queue.filter(op => op.id !== operationId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
  
  window.dispatchEvent(new CustomEvent('offlineQueueUpdated', { detail: { count: filtered.length } }));
}

export function updateOperationRetry(operationId: string): boolean {
  const queue = getOfflineQueue();
  const index = queue.findIndex(op => op.id === operationId);
  
  if (index === -1) return false;
  
  queue[index].retryCount++;
  
  if (queue[index].retryCount >= MAX_RETRIES) {
    // Remove failed operation after max retries
    queue.splice(index, 1);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent('offlineQueueUpdated', { detail: { count: queue.length } }));
    return false;
  }
  
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return true;
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
  window.dispatchEvent(new CustomEvent('offlineQueueUpdated', { detail: { count: 0 } }));
}

export function getQueueCount(): number {
  return getOfflineQueue().length;
}
