import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DatePresetKey,
  DatePresetFilterValue,
  DATE_PRESETS,
  isDateWithinPreset,
  getDateRangeForPreset,
} from "@/lib/dateFilterUtils";

export type { DatePresetKey, DatePresetFilterValue };
export { DATE_PRESETS, isDateWithinPreset, getDateRangeForPreset };

export interface DateFilterProps {
  value?: DatePresetFilterValue;
  onChange?: (val: DatePresetFilterValue) => void;
  defaultValue?: DatePresetFilterValue;
  className?: string;
  triggerClassName?: string;
}

export const DEFAULT_DATE_FILTER: DatePresetFilterValue = {
  preset: "this_month",
};

export function DateFilter({
  value: controlledValue,
  onChange,
  defaultValue = DEFAULT_DATE_FILTER,
  className,
  triggerClassName,
}: DateFilterProps) {
  const [internalValue, setInternalValue] = useState<DatePresetFilterValue>(defaultValue);
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const [open, setOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(activeValue.customFrom || "");
  const [tempTo, setTempTo] = useState(activeValue.customTo || "");

  const activeLabel = useMemo(() => {
    if (activeValue.preset === "custom" && activeValue.customFrom) {
      try {
        const fromLabel = format(parseISO(activeValue.customFrom), "dd MMM");
        const toLabel = activeValue.customTo ? format(parseISO(activeValue.customTo), "dd MMM") : fromLabel;
        return `${fromLabel} - ${toLabel}`;
      } catch {
        return "Custom Range";
      }
    }
    const found = DATE_PRESETS.find((p) => p.key === activeValue.preset);
    return found ? found.label : "This Month";
  }, [activeValue]);

  const handleUpdate = (nextVal: DatePresetFilterValue) => {
    if (!isControlled) {
      setInternalValue(nextVal);
    }
    onChange?.(nextVal);
  };

  const handleSelectPreset = (key: DatePresetKey) => {
    if (key === "custom") {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const next: DatePresetFilterValue = {
        preset: "custom",
        customFrom: tempFrom || todayStr,
        customTo: tempTo || todayStr,
      };
      handleUpdate(next);
    } else {
      handleUpdate({ preset: key });
      setOpen(false);
    }
  };

  const handleApplyCustom = () => {
    if (!tempFrom) return;
    handleUpdate({
      preset: "custom",
      customFrom: tempFrom,
      customTo: tempTo || tempFrom,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-9 text-xs font-medium px-3 rounded-lg flex items-center justify-between gap-2 border-border/80 bg-background hover:bg-muted/40 transition-colors shrink-0",
            activeValue.preset !== "this_month" && activeValue.preset !== "all" && "border-primary/50 text-primary font-semibold",
            triggerClassName,
            className
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{activeLabel}</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 z-50 text-xs" align="start">
        <div className="space-y-1">
          <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Filter by Date
          </p>
          <div className="grid grid-cols-2 gap-1">
            {DATE_PRESETS.filter((p) => p.key !== "custom").map((p) => {
              const isSelected = activeValue.preset === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleSelectPreset(p.key)}
                  className={cn(
                    "flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors text-xs",
                    isSelected
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "hover:bg-muted/60 text-foreground"
                  )}
                >
                  <span>{p.label}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Custom Range Option */}
          <div className="pt-2 border-t mt-2">
            <button
              type="button"
              onClick={() => handleSelectPreset("custom")}
              className={cn(
                "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors text-xs mb-2",
                activeValue.preset === "custom"
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "hover:bg-muted/60 text-foreground"
              )}
            >
              <span>Custom Range</span>
              {activeValue.preset === "custom" && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>

            {activeValue.preset === "custom" && (
              <div className="space-y-2 pt-1 px-1">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-0.5 block">From</label>
                    <Input
                      type="date"
                      value={tempFrom}
                      onChange={(e) => setTempFrom(e.target.value)}
                      className="h-8 text-xs px-2"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-0.5 block">To</label>
                    <Input
                      type="date"
                      value={tempTo}
                      onChange={(e) => setTempTo(e.target.value)}
                      className="h-8 text-xs px-2"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApplyCustom}
                  className="w-full h-8 text-xs font-semibold"
                >
                  Apply Range
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateFilter;

