import { useState, useCallback } from "react";
import { toast } from "sonner";

export interface UseCopyOptions {
  label?: string;
  isAmount?: boolean;
  toastMessage?: string;
}

export function cleanCopyValue(
  val: string | number | null | undefined,
  isAmount = false
): string {
  if (val === null || val === undefined) return "";
  let s = String(val).trim();
  if (!s) return "";

  if (isAmount) {
    // Strip commas, PKR, pkr, Rs, etc.
    const numericStr = s.replace(/[^0-9.-]/g, "");
    return numericStr;
  }

  // Strip prefixes like "PNR:", "PNR -", "Invoice #", "Inv:", "Ticket #", "Tkt:", "Ref:", "Voucher:", "Refund:", "Exp:"
  s = s.replace(
    /^(pnr|invoice|inv|ticket|tkt|voucher|vch|refund|ref|expense|exp)\s*[:#\-–—]?\s*/i,
    ""
  );
  return s.trim();
}

export function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = useCallback(
    async (
      value: string | number | null | undefined,
      key = "default",
      options?: UseCopyOptions
    ) => {
      const clean = cleanCopyValue(value, options?.isAmount);
      if (!clean) return false;

      let success = false;
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(clean);
          success = true;
        } else {
          throw new Error("Clipboard API unavailable");
        }
      } catch {
        // Fallback using textarea + execCommand
        try {
          const textarea = document.createElement("textarea");
          textarea.value = clean;
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
        setCopiedKey(key);
        toast.success(options?.toastMessage || "Copied", {
          duration: 1200,
        });
        setTimeout(() => {
          setCopiedKey((curr) => (curr === key ? null : curr));
        }, 1000);
      }
      return success;
    },
    []
  );

  return { copy, copiedKey, isCopied: (key = "default") => copiedKey === key };
}

