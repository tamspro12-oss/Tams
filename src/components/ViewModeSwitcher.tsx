import { Button } from "@/components/ui/button";
import { Monitor, Smartphone } from "lucide-react";
import { useViewMode } from "@/contexts/ViewModeContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ViewModeSwitcher() {
  const { viewMode, toggleViewMode } = useViewMode();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={toggleViewMode}
            className="gap-2"
          >
            {viewMode === 'desktop' ? (
              <Monitor className="h-4 w-4" />
            ) : (
              <Smartphone className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Switch to {viewMode === 'desktop' ? 'Mobile' : 'Desktop'} View</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
