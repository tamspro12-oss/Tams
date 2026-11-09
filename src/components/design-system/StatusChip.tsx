import React from "react";
import { cn } from "@/lib/utils";

export type StatusType =
  | "paid"
  | "unpaid"
  | "overdue"
  | "partial"
  | "pending"
  | "void"
  | "refund"
  | "active"
  | "inactive"
  | string;

interface StatusChipProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  status,
  label,
  size = "md",
  className,
}) => {
  const norm = (status || "").toLowerCase().trim();
  const displayLabel = label || status || "Pending";

  let colorClasses = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

  if (norm === "paid" || norm === "active" || norm === "success" || norm === "confirmed") {
    colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
  } else if (norm === "unpaid" || norm === "overdue" || norm === "failed" || norm === "cancelled") {
    colorClasses = "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800";
  } else if (norm === "partial" || norm === "pending" || norm === "in-progress" || norm === "warning") {
    colorClasses = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
  } else if (norm === "void" || norm === "voided" || norm === "inactive") {
    colorClasses = "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700";
  } else if (norm === "refund" || norm === "refunded") {
    colorClasses = "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-full border select-none transition-colors",
        size === "sm"
          ? "px-2 py-0.5 text-[11px] leading-tight"
          : "px-2.5 py-1 text-xs leading-normal",
        colorClasses,
        className
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full mr-1.5 shrink-0",
          norm === "paid" || norm === "active"
            ? "bg-emerald-500"
            : norm === "unpaid" || norm === "overdue"
            ? "bg-red-500"
            : norm === "partial" || norm === "pending"
            ? "bg-amber-500"
            : norm === "refund"
            ? "bg-purple-500"
            : "bg-slate-400"
        )}
      />
      {displayLabel}
    </span>
  );
};

