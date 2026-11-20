import { useRef } from "react";
import { useFormKeyboardNav } from "@/hooks/useFormKeyboardNav";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useDateFilter, DateFilterPreset } from "@/contexts/DateFilterContext";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export interface DateFilterSelectorProps {
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

export function DateFilterSelector({ className, size = "sm" }: DateFilterSelectorProps = {}) {
  const { filter, setPreset, setCustomRange, getFilterLabel } = useDateFilter();
  const isMobile = useIsMobile();
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customRange, setCustomRangeState] = useState<DateRange | undefined>();

  const handlePresetClick = (preset: DateFilterPreset) => {
    if (preset === "custom") {
      setShowCustomDialog(true);
    } else {
      setPreset(preset);
    }
  };

  const handleCustomApply = () => {
    if (customRange?.from) {
      setCustomRange(customRange.from, customRange.to || customRange.from);
      setShowCustomDialog(false);
    }
  };

  const customDialogRef = useRef<HTMLDivElement>(null);

  useFormKeyboardNav({
    containerRef: customDialogRef,
    enabled: showCustomDialog,
    autoFocusFirst: true,
    onCancel: () => setShowCustomDialog(false),
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size={size} className={cn("gap-2 text-xs", className)}>
            <Calendar className="w-4 h-4" />
            <span>{getFilterLabel()}</span>
            <ChevronDown className="w-4 h-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => handlePresetClick("current_month")}>
            This Month
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetClick("last_month")}>
            Last Month
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetClick("last_3_months")}>
            Last 3 Months
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handlePresetClick("year_to_date")}>
            Year to Date
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handlePresetClick("all_time")}>
            All Time
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handlePresetClick("custom")}>
            Custom Range...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent ref={customDialogRef}>
          <DialogHeader>
            <DialogTitle>Select Custom Date Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <CalendarComponent
              mode="range"
              selected={customRange}
              onSelect={setCustomRangeState}
              numberOfMonths={isMobile ? 1 : 2}
              className="pointer-events-auto mx-auto"
            />
            <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
              <div className="text-sm text-muted-foreground">
                {customRange?.from && (
                  <>
                    {format(customRange.from, "MMM dd, yyyy")}
                    {customRange.to && ` - ${format(customRange.to, "MMM dd, yyyy")}`}
                  </>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                <Button variant="outline" onClick={() => setShowCustomDialog(false)} className="w-full md:w-auto">
                  Cancel
                </Button>
                <Button onClick={handleCustomApply} disabled={!customRange?.from} className="w-full md:w-auto">
                  Apply
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
