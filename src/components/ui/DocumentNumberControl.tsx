import React, { useState, useEffect } from "react";
import { Lock, Pencil, RotateCcw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CopyValue } from "@/components/ui/CopyValue";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type AutoDocType =
  | "invoice"
  | "voucher_crv"
  | "voucher_cpv"
  | "voucher_uv"
  | "voucher_hv"
  | "voucher_tv"
  | "refund"
  | "void"
  | "expense"
  | "quotation"
  | "client"
  | "vendor"
  | "reminder"
  | "transfer"
  | "sub_user";

export async function checkDocumentNumberAvailable(
  docType: AutoDocType,
  value: string,
  excludeId?: string | null
): Promise<boolean> {
  const trimmed = value.trim();
  if (!trimmed || /^(__AUTO__|preview|auto-generated)$/i.test(trimmed)) {
    return false;
  }

  try {
    const { data, error } = await (supabase as any).rpc("check_document_number_available", {
      p_doc_type: docType,
      p_number: trimmed,
      p_exclude_id: excludeId ?? null,
    });
    if (error) {
      console.warn("Availability check warning:", error);
      return true;
    }
    return Boolean(data);
  } catch (err) {
    console.warn("Availability check failed:", err);
    return true;
  }
}

interface DocumentNumberControlProps {
  label?: string;
  docType: AutoDocType;
  previewNumber: string;
  isManual: boolean;
  manualValue: string;
  onManualModeChange: (manual: boolean) => void;
  onManualValueChange: (value: string) => void;
  onAvailabilityChange?: (available: boolean | null) => void;
  excludeId?: string | null;
  accentClassName?: string;
  allowManualOverride?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  className?: string;
}

export const DocumentNumberControl: React.FC<DocumentNumberControlProps> = ({
  label = "Number:",
  docType,
  previewNumber,
  isManual,
  manualValue,
  onManualModeChange,
  onManualValueChange,
  onAvailabilityChange,
  excludeId = null,
  accentClassName = "text-blue-600 dark:text-blue-400",
  allowManualOverride = true,
  readOnly = false,
  compact = false,
  className,
}) => {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isManual) {
      setAvailable(null);
      onAvailabilityChange?.(null);
      return;
    }

    const trimmed = manualValue.trim();
    if (!trimmed) {
      setAvailable(false);
      onAvailabilityChange?.(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    const timer = window.setTimeout(async () => {
      const ok = await checkDocumentNumberAvailable(docType, trimmed, excludeId);
      if (!cancelled) {
        setAvailable(ok);
        setChecking(false);
        onAvailabilityChange?.(ok);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isManual, manualValue, docType, excludeId, onAvailabilityChange]);

  const handleEnableManual = () => {
    if (readOnly || !allowManualOverride) return;
    if (!manualValue.trim() && previewNumber) {
      onManualValueChange(previewNumber);
    }
    onManualModeChange(true);
  };

  const handleResetAuto = () => {
    onManualModeChange(false);
    setAvailable(null);
    onAvailabilityChange?.(null);
  };

  return (
    <div
      data-nav-skip="true"
      className={cn(
        "flex flex-wrap items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded border text-xs font-mono font-bold text-slate-700 dark:text-slate-200 max-w-full",
        compact && "py-0.5 text-[11px]",
        className
      )}
    >
      {!isManual ? (
        <>
          <Lock className="w-3 h-3 text-slate-400 shrink-0" />
          <span className="shrink-0">{label}</span>
          <CopyValue
            value={previewNumber || "Auto-assigned"}
            label={label.replace(":", "").toLowerCase()}
            className={cn("truncate max-w-[160px] sm:max-w-none", accentClassName)}
          />
          <Badge variant="secondary" className="text-[9px] px-1 h-4 ml-0.5 shrink-0">
            Auto
          </Badge>
          {allowManualOverride && !readOnly && (
            <button
              type="button"
              tabIndex={-1}
              data-no-enter-nav="true"
              onClick={handleEnableManual}
              title="Switch to manual number override"
              className="ml-0.5 inline-flex items-center gap-0.5 text-[10px] font-sans font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer px-1 py-0.5 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
            >
              <Pencil className="w-2.5 h-2.5" />
              <span className="hidden sm:inline">Manual</span>
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="shrink-0">{label}</span>
          <Input
            value={manualValue}
            onChange={(e) => onManualValueChange(e.target.value)}
            placeholder={previewNumber || "Enter number"}
            aria-label={`Manual ${label}`}
            className="h-6 w-36 sm:w-44 text-[11px] font-mono font-bold px-1.5 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700"
          />
          {checking ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
          ) : available === true ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-sans font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-3 h-3" /> OK
            </span>
          ) : available === false ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-sans font-semibold text-red-600 dark:text-red-400 shrink-0">
              <AlertCircle className="w-3 h-3" /> In use
            </span>
          ) : null}
          <button
            type="button"
            tabIndex={-1}
            data-no-enter-nav="true"
            onClick={handleResetAuto}
            title="Switch back to Auto numbering"
            className="inline-flex items-center gap-0.5 text-[10px] font-sans font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer px-1 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            Auto
          </button>
        </div>
      )}
    </div>
  );
};

