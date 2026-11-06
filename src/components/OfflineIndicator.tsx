import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { WifiOff, CloudOff, Loader2, CloudUpload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const { pendingCount, isSyncing, syncQueue, hasPendingChanges } = useOfflineQueue();

  // Show nothing if online and no pending changes
  if (isOnline && !hasPendingChanges && !isSyncing) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Offline Banner */}
      {!isOnline && (
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
          "bg-warning/10 text-warning border border-warning/20"
        )}>
          <WifiOff className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Offline</span>
        </div>
      )}

      {/* Pending Changes Indicator */}
      {hasPendingChanges && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => isOnline && syncQueue()}
          disabled={!isOnline || isSyncing}
          className={cn(
            "h-8 gap-1.5 text-xs",
            isSyncing 
              ? "text-primary" 
              : "text-amber-600 dark:text-amber-400 hover:text-amber-700"
          )}
        >
          {isSyncing ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">Syncing...</span>
            </>
          ) : (
            <>
              <CloudUpload className="h-3.5 w-3.5" />
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                {pendingCount}
              </Badge>
              <span className="hidden sm:inline">pending</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
