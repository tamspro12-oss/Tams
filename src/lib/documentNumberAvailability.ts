import { supabase } from "@/integrations/supabase/client";
import { logAndFriendlyMessage } from "@/lib/friendlyError";

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

export interface DocumentNumberAvailabilityCheck {
  available: boolean;
  failed: boolean;
  errorMessage?: string;
}

export type DocumentNumberRpcInvoker = (
  fn: string,
  args: Record<string, unknown>
) => Promise<{ data: unknown; error: unknown }>;

const defaultRpcInvoker: DocumentNumberRpcInvoker = async (fn, args) =>
  (supabase as any).rpc(fn, args);

/**
 * Checks whether a manual document number is available for the active agency.
 * FAILS CLOSED: any RPC or network error returns `{ available: false, failed: true }`.
 */
export async function checkDocumentNumberAvailabilityDetailed(
  docType: AutoDocType,
  value: string,
  excludeId?: string | null,
  rpcInvoker: DocumentNumberRpcInvoker = defaultRpcInvoker
): Promise<DocumentNumberAvailabilityCheck> {
  const trimmed = value.trim();
  if (!trimmed || /^(__AUTO__|preview|auto-generated)$/i.test(trimmed)) {
    return { available: false, failed: false };
  }

  try {
    const { data, error } = await rpcInvoker("check_document_number_available", {
      p_doc_type: docType,
      p_number: trimmed,
      p_exclude_id: excludeId ?? null,
    });
    if (error) {
      const errorMessage = logAndFriendlyMessage(
        "DocumentNumberControl.checkAvailability",
        error,
        "Could not check number availability. Please try again."
      );
      return { available: false, failed: true, errorMessage };
    }
    return { available: Boolean(data), failed: false };
  } catch (err) {
    const errorMessage = logAndFriendlyMessage(
      "DocumentNumberControl.checkAvailability",
      err,
      "Could not check number availability. Please try again."
    );
    return { available: false, failed: true, errorMessage };
  }
}

export async function checkDocumentNumberAvailable(
  docType: AutoDocType,
  value: string,
  excludeId?: string | null,
  rpcInvoker?: DocumentNumberRpcInvoker
): Promise<boolean> {
  const res = await checkDocumentNumberAvailabilityDetailed(
    docType,
    value,
    excludeId,
    rpcInvoker
  );
  return res.available && !res.failed;
}
