import { useState, useEffect } from "react";
import { sessionManager } from "@/lib/sessionManager";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function SessionTimer() {
  const [remainingTime, setRemainingTime] = useState<number>(0);

  useEffect(() => {
    // Update timer every 30 seconds
    const updateTimer = () => {
      const remaining = sessionManager.getRemainingTime();
      setRemainingTime(remaining);
    };

    // Initial update
    updateTimer();

    // Update every 30 seconds
    const interval = setInterval(updateTimer, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (ms: number): string => {
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (remainingTime === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary"
            className="gap-2 cursor-help"
          >
            <Clock className="h-3 w-3" />
            {formatTime(remainingTime)}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">
            Time until auto-logout (1 hour of inactivity)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
