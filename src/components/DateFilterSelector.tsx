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

export function DateFilterSelector() {
  const { filter, setPreset, setCustomRange, getFilterLabel } = useDateFilter();
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Calendar className="w-4 h-4" />
            {getFilterLabel()}
            <ChevronDown className="w-4 h-4" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Custom Date Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <CalendarComponent
              mode="range"
              selected={customRange}
              onSelect={setCustomRangeState}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {customRange?.from && (
                  <>
                    {format(customRange.from, "MMM dd, yyyy")}
                    {customRange.to && ` - ${format(customRange.to, "MMM dd, yyyy")}`}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCustomDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCustomApply} disabled={!customRange?.from}>
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
