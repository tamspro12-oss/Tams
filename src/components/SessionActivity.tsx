import { useState, useEffect } from "react";
import { sessionManager } from "@/lib/sessionManager";
import { Clock, Activity, Shield } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

export function SessionActivity() {
  const [remainingTime, setRemainingTime] = useState<number>(0);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const updateSession = () => {
      const remaining = sessionManager.getRemainingTime();
      const currentSession = sessionManager.getSession();
      
      setRemainingTime(remaining);
      setSession(currentSession);
    };

    // Initial update
    updateSession();

    // Update every 10 seconds
    const interval = setInterval(updateSession, 10000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number): string => {
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getProgressValue = () => {
    const SESSION_TIMEOUT = 60 * 60 * 1000; // 1 hour
    return (remainingTime / SESSION_TIMEOUT) * 100;
  };

  const getProgressColor = () => {
    const percent = getProgressValue();
    if (percent < 17) return "bg-destructive"; // Less than 10 minutes
    if (percent < 33) return "bg-warning"; // Less than 20 minutes
    return "bg-success"; // More than 20 minutes
  };

  if (!session) {
    return (
      <div className="p-4 border rounded-lg bg-muted/50">
        <p className="text-sm text-muted-foreground">
          No active session found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact Session Info */}
      <div className="p-4 border rounded-lg bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-success" />
            <span className="text-sm font-medium">Session Active</span>
          </div>
          <span className="text-lg font-bold">{formatTime(remainingTime)}</span>
        </div>
        
        <Progress 
          value={getProgressValue()} 
          className="h-2"
        />
        
        {remainingTime < 10 * 60 * 1000 && remainingTime > 0 && (
          <p className="text-xs text-destructive mt-2">
            ⚠️ Session expiring soon! Interact with the app to extend.
          </p>
        )}
      </div>
    </div>
  );
}
