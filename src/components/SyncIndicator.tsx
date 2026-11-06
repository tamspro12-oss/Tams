import { useSync } from '@/contexts/SyncContext';
import { RefreshCw, Wifi, WifiOff, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export function SyncIndicator() {
  const { status, lastSyncTime, isOnline, triggerSync } = useSync();

  const getStatusConfig = () => {
    switch (status) {
      case 'syncing':
        return {
          icon: RefreshCw,
          text: 'Syncing...',
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          animate: true,
        };
      case 'synced':
        return {
          icon: Check,
          text: 'Synced',
          color: 'text-success',
          bgColor: 'bg-success/10',
          animate: false,
        };
      case 'error':
        return {
          icon: AlertCircle,
          text: 'Sync failed',
          color: 'text-destructive',
          bgColor: 'bg-destructive/10',
          animate: false,
        };
      case 'offline':
        return {
          icon: WifiOff,
          text: 'Offline',
          color: 'text-warning',
          bgColor: 'bg-warning/10',
          animate: false,
        };
      default:
        return {
          icon: Wifi,
          text: 'Online',
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          animate: false,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={triggerSync}
      disabled={status === 'syncing' || !isOnline}
      className={cn(
        "h-8 w-8 md:h-9 md:w-auto md:gap-2 md:px-3 p-0 text-xs font-medium transition-all duration-300",
        config.bgColor,
        config.color,
        "hover:scale-105 active:scale-95"
      )}
    >
      <Icon 
        className={cn(
          "h-4 w-4",
          config.animate && "animate-spin"
        )} 
      />
      <span className="hidden md:inline">{config.text}</span>
      {lastSyncTime && status === 'idle' && (
        <span className="hidden lg:inline text-[10px] text-muted-foreground">
          {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
        </span>
      )}
    </Button>
  );
}
