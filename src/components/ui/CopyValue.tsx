import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { cleanCopyValue } from "@/hooks/useCopy";
import { cn } from "@/lib/utils";

export interface CopyValueProps {
  value: string | number | null | undefined;
  cleanValue?: string;
  displayValue?: React.ReactNode;
  label?: string; // For aria-label e.g. "invoice number"
  isAmount?: boolean;
  className?: string;
  iconClassName?: string;
  children?: React.ReactNode;
}

export const CopyValue: React.FC<CopyValueProps> = ({
  value,
  cleanValue,
  displayValue,
  label = "value",
  isAmount = false,
  className,
  iconClassName,
  children,
}) => {
  const [copied, setCopied] = useState(false);

  const rawClean = cleanValue ?? cleanCopyValue(value, isAmount);
  if (!rawClean) {
    return <span className={className}>{children ?? displayValue ?? value ?? "—"}</span>;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let success = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(rawClean);
        success = true;
      } else {
        throw new Error("No writeText");
      }
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = rawClean;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "-9999px";
        textarea.setAttribute("readonly", "");
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        success = false;
      }
    }

    if (success) {
      setCopied(true);
      toast.success("Copied", { duration: 1200 });
      setTimeout(() => setCopied(false), 1000);
    }
  };

  return (
    <span
      className={cn(
        "group/copy inline-flex items-center gap-1 select-text cursor-default max-w-full align-middle",
        className
      )}
      title="Click icon to copy, double-click to select"
    >
      <span className="select-text truncate">{children ?? displayValue ?? value}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        className={cn(
          "inline-flex items-center justify-center p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity shrink-0",
          // Desktop: visible on hover (either copy component hover or row hover via .group:hover)
          // Mobile/touch: always visible
          "opacity-100 sm:opacity-0 sm:group-hover/copy:opacity-100 sm:group-hover:opacity-100",
          iconClassName
        )}
      >
        {copied ? (
          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 animate-in zoom-in-50 duration-150" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    </span>
  );
};

