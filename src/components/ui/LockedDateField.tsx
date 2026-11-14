import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Calendar } from "lucide-react";
import { getKarachiYmd } from "@/lib/karachiTime";

export function getTodayDateString(): string {
  return getKarachiYmd();
}

interface LockedDateFieldProps {
  id?: string;
  label?: string;
  name?: string;
  value?: string;
  onChange?: (date: string) => void;
  required?: boolean;
  className?: string;
  helperText?: string;
}

export const LockedDateField: React.FC<LockedDateFieldProps> = ({
  id,
  label = "Transaction Date",
  name,
  value,
  onChange,
  required = true,
  className = "",
  helperText = "Locked to current system date for audit integrity",
}) => {
  // Always lock to current system date YYYY-MM-DD
  const todayStr = getTodayDateString();
  const currentDate = todayStr;

  React.useEffect(() => {
    if (onChange && value !== todayStr) {
      onChange(todayStr);
    }
  }, [value, onChange, todayStr]);

  return (
    <div className={`space-y-1 ${className}`} data-locked-date="true">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-slate-400" />
          {label} {required && <span className="text-red-500">*</span>}
        </Label>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200/60 dark:border-amber-800/60">
          <Lock className="w-2.5 h-2.5" />
          Locked
        </span>
      </div>

      <div className="relative">
        <Input
          id={id}
          type="date"
          value={currentDate}
          readOnly
          disabled
          tabIndex={-1}
          data-locked-date="true"
          aria-readonly="true"
          title={helperText}
          className="h-8 text-xs font-mono bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-not-allowed select-none pr-7 opacity-90 focus-visible:ring-0"
        />
        {name && <input type="hidden" name={name} value={currentDate} />}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <Lock className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
      {helperText && (
        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
          {helperText}
        </p>
      )}
    </div>
  );
};
