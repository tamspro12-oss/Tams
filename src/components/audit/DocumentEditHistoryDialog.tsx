import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { isMissingTableError, toFriendlyMessage } from "@/lib/friendlyError";
import {
  formatAuditFieldLabel,
  formatAuditFieldValue,
  formatEditedTimestamp,
  type DocumentEditHistoryEntry,
  type EditableDocumentType,
} from "@/lib/documentEditHelpers";
import {
  History,
  User,
  Clock,
  ArrowRight,
  Loader2,
  BookOpenCheck,
  AlertCircle,
} from "lucide-react";

interface DocumentEditHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: EditableDocumentType | null;
  documentId: string | null;
  documentNo?: string | null;
}

const DOC_TYPE_TITLES: Record<EditableDocumentType, string> = {
  booking_invoice: "Booking Invoice",
  payment_voucher: "Payment Voucher",
  refund: "Refund / Void",
};

export const DocumentEditHistoryDialog: React.FC<DocumentEditHistoryDialogProps> = ({
  open,
  onOpenChange,
  documentType,
  documentId,
  documentNo,
}) => {
  const { data: agencyId } = useCurrentAgencyId();

  const {
    data: historyRows = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["document_edit_history", agencyId, documentType, documentId],
    enabled: Boolean(open && agencyId && documentType && documentId),
    queryFn: async () => {
      if (!agencyId || !documentType || !documentId) return [];
      const { data, error: qError } = await (supabase as any)
        .from("document_edit_history")
        .select("*")
        .eq("agency_id", agencyId)
        .eq("document_type", documentType)
        .eq("document_id", documentId)
        .order("edited_at", { ascending: false });

      if (qError) {
        if (isMissingTableError(qError, "document_edit_history")) {
          return [];
        }
        throw qError;
      }

      return (data || []) as DocumentEditHistoryEntry[];
    },
  });

  const typeLabel = documentType ? DOC_TYPE_TITLES[documentType] : "Document";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-5 py-3.5 border-b bg-white dark:bg-slate-900 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base font-bold pr-6">
            <History className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Edit History</span>
            {documentNo && (
              <Badge variant="outline" className="font-mono text-xs ml-1">
                {documentNo}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Complete append-only audit trail for this {typeLabel.toLowerCase()} record.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-xs text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading audit history...
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{toFriendlyMessage(error, "Could not load edit history.")}</span>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : historyRows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
              No edits recorded for this document yet.
            </div>
          ) : (
            historyRows.map((entry, idx) => {
              const editNumber = historyRows.length - idx;
              const oldVals =
                entry.old_values && typeof entry.old_values === "object" ? entry.old_values : {};
              const newVals =
                entry.new_values && typeof entry.new_values === "object" ? entry.new_values : {};

              const displayKeys = Array.from(
                new Set([...Object.keys(oldVals), ...Object.keys(newVals)])
              );

              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-card p-3.5 space-y-2.5 shadow-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px] px-1.5 py-0"
                      >
                        Edit #{editNumber}
                      </Badge>
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                        <User className="w-3 h-3 text-slate-500" />
                        {entry.edited_by_name || "Agency User"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatEditedTimestamp(entry.edited_at)}
                      </span>
                    </div>

                    {entry.affected_ledger && (
                      <Badge
                        variant="outline"
                        className="text-[10px] gap-1 border-teal-300 bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800"
                      >
                        <BookOpenCheck className="w-3 h-3" />
                        Ledger Corrected
                      </Badge>
                    )}
                  </div>

                  <div className="rounded-md bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 px-2.5 py-1.5 text-xs">
                    <span className="font-semibold text-amber-900 dark:text-amber-300">
                      Reason:{" "}
                    </span>
                    <span className="text-slate-800 dark:text-slate-200">{entry.reason}</span>
                  </div>

                  {displayKeys.length > 0 && (
                    <div className="divide-y divide-border/60 rounded-md border bg-muted/20">
                      {displayKeys.map((fieldKey) => (
                        <div
                          key={fieldKey}
                          className="px-2.5 py-1.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                        >
                          <span className="font-medium text-muted-foreground shrink-0">
                            {formatAuditFieldLabel(fieldKey)}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] sm:justify-end">
                            <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 line-through dark:bg-red-950/40 dark:text-red-300 break-all">
                              {formatAuditFieldValue(fieldKey, oldVals[fieldKey])}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300 break-all">
                              {formatAuditFieldValue(fieldKey, newVals[fieldKey])}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t bg-slate-50 dark:bg-slate-900 flex justify-end shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs cursor-pointer"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

