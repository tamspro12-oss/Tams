import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusChip } from "@/components/design-system";
import { usePartyLedger } from "@/hooks/usePartyLedger";
import { SendStatementDialog } from "@/components/parties/SendStatementDialog";
import { InvoiceQuickViewDialog } from "@/components/vouchers/InvoiceQuickViewDialog";
import { VoucherQuickViewDialog } from "@/components/vouchers/VoucherQuickViewDialog";
import {
  filterPartyLedgerRows,
  formatDrCrAmount,
  getDrCrLabelForParty,
  resolveLedgerFilterDates,
  type LedgerDatePreset,
  type LedgerTypeFilter,
  type PartyLedgerEntry,
  type PartyLedgerPartyInput,
} from "@/lib/partyLedger";
import {
  AlertCircle,
  FileText,
  RefreshCw,
  Search,
  Send,
  X,
} from "lucide-react";

const PAGE_SIZE = 100;

export interface PartyLedgerViewParty extends PartyLedgerPartyInput {
  notes?: string | null;
}

interface PartyLedgerViewProps {
  party: PartyLedgerViewParty;
  onToggleActive?: (party: PartyLedgerViewParty) => Promise<void> | void;
  isUpdatingStatus?: boolean;
}

export const PartyLedgerView: React.FC<PartyLedgerViewProps> = ({
  party,
  onToggleActive,
  isUpdatingStatus = false,
}) => {
  const { ledger, isLoading, isError, refetch } = usePartyLedger(party);

  const [datePreset, setDatePreset] = useState<LedgerDatePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<LedgerTypeFilter>("all");
  const [referenceSearch, setReferenceSearch] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [inspectedInvoice, setInspectedInvoice] = useState<any | null>(null);
  const [inspectedVoucher, setInspectedVoucher] = useState<any | null>(null);
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);

  // Reset pagination & transient viewers when switching party
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
    setInspectedInvoice(null);
    setInspectedVoucher(null);
    setConfirmToggleOpen(false);
  }, [party.id]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleLimit(PAGE_SIZE);
  }, [datePreset, customFrom, customTo, typeFilter, referenceSearch]);

  const filtered = useMemo(() => {
    return filterPartyLedgerRows(ledger, {
      datePreset,
      customFrom,
      customTo,
      typeFilter,
      referenceSearch,
    });
  }, [ledger, datePreset, customFrom, customTo, typeFilter, referenceSearch]);

  const visibleRows = useMemo(
    () => filtered.rowsNewestFirst.slice(0, visibleLimit),
    [filtered.rowsNewestFirst, visibleLimit]
  );

  const remainingRowsCount = Math.max(0, filtered.rowsNewestFirst.length - visibleRows.length);

  // Compute initial custom dates for Send Statement dialog if a ledger date filter is active
  const statementPrefillDates = useMemo(() => {
    if (datePreset === "custom") {
      return { from: customFrom, to: customTo };
    }
    if (datePreset !== "all") {
      const resolved = resolveLedgerFilterDates(datePreset);
      return {
        from: resolved.fromDate || "",
        to: resolved.toDate || "",
      };
    }
    return { from: "", to: "" };
  }, [datePreset, customFrom, customTo]);

  // Match exact main-list DR/CR formatting for Current Net Balance
  const storedBal = Number(party.current_balance) || 0;
  const isReceivable = storedBal > 0;
  const isPayable = storedBal < 0;
  const isZero = storedBal === 0;
  const drCrCode = isReceivable ? "DR" : isPayable ? "CR" : "";
  const { statusLabel } = getDrCrLabelForParty(storedBal, party.type);

  const typeBadgeLabel =
    party.type === "vendor" ? "Vendor" : party.type === "both" ? "Both" : "Client";

  const hasActiveFilters =
    datePreset !== "all" || typeFilter !== "all" || referenceSearch.trim().length > 0;

  const resetFilters = () => {
    setDatePreset("all");
    setCustomFrom("");
    setCustomTo("");
    setTypeFilter("all");
    setReferenceSearch("");
  };

  const handleRowClick = (row: PartyLedgerEntry) => {
    if (row.sourceKind === "invoice" && row.sourceRecord) {
      setInspectedInvoice(row.sourceRecord);
    } else if (row.sourceKind === "voucher" && row.sourceRecord) {
      setInspectedVoucher(row.sourceRecord);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!onToggleActive) return;
    try {
      await onToggleActive(party);
    } catch {
      // Friendly error handled by hook mutation
    } finally {
      setConfirmToggleOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header: party code & name, type badge, and compact Send Statement button below name */}
      <div className="space-y-2 pr-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono font-semibold text-muted-foreground">
            {party.code || "PARTY"}
          </span>
          <StatusChip status={party.type} label={typeBadgeLabel} size="sm" />
          {party.active === false && (
            <StatusChip status="cancelled" label="INACTIVE" size="sm" />
          )}
        </div>

        <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight break-words">
          {party.name}
        </h2>

        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsStatementOpen(true)}
            className="w-fit h-7 px-2.5 text-xs gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            Send Statement
          </Button>
        </div>
      </div>

      {/* Prominent Current Net Balance + Compact One-Line Info Row */}
      <div className="rounded-xl border bg-slate-50/80 dark:bg-slate-800/50 p-3.5 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Current Net Balance
          </span>
          <div className="flex flex-wrap items-baseline gap-2">
            <span
              className={`text-xl sm:text-2xl font-bold font-mono ${
                isZero
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              PKR {Math.abs(storedBal).toLocaleString()} {drCrCode}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Compact one-line info row: phone, city, credit limit, opening balance */}
        <div className="pt-2 border-t border-border/60 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Phone: <strong className="text-foreground font-medium">{party.phone || "—"}</strong>
          </span>
          <span>
            City: <strong className="text-foreground font-medium">{party.city || "—"}</strong>
          </span>
          <span>
            Credit Limit:{" "}
            <strong className="text-foreground font-mono font-medium">
              PKR {(Number(party.credit_limit) || 0).toLocaleString()}
            </strong>
          </span>
          <span>
            Opening Balance:{" "}
            <strong className="text-foreground font-mono font-medium">
              {formatDrCrAmount(Number(party.opening_balance) || 0)}
            </strong>
          </span>
        </div>

        {ledger.hasMismatch && !isLoading && !isError && (
          <div className="rounded-md border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
            Note: The ledger entries total ({formatDrCrAmount(ledger.closingBalance)}) differs
            from the party current balance ({formatDrCrAmount(ledger.storedCurrentBalance)}) due
            to prior refund or adjustment history.
          </div>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 bg-card border rounded-lg p-2.5">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={referenceSearch}
            onChange={(e) => setReferenceSearch(e.target.value)}
            placeholder="Search reference or remarks..."
            className="h-8 pl-8 pr-7 text-xs"
          />
          {referenceSearch && (
            <button
              type="button"
              onClick={() => setReferenceSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Select
          value={datePreset}
          onValueChange={(val) => setDatePreset(val as LedgerDatePreset)}
        >
          <SelectTrigger className="h-8 w-full sm:w-[140px] text-xs">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="last_month">Last month</SelectItem>
            <SelectItem value="last_3_months">Last 3 months</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(val) => setTypeFilter(val as LedgerTypeFilter)}
        >
          <SelectTrigger className="h-8 w-full sm:w-[130px] text-xs">
            <SelectValue placeholder="Entry type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entries</SelectItem>
            <SelectItem value="invoices">Invoices</SelectItem>
            <SelectItem value="payments">Payments</SelectItem>
          </SelectContent>
        </Select>

        {datePreset === "custom" && (
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Input
              type="date"
              aria-label="From date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 text-xs flex-1 sm:w-[130px]"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              aria-label="To date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 text-xs flex-1 sm:w-[130px]"
            />
          </div>
        )}
      </div>

      {/* Ledger Body: Loading / Error / Empty / Table + Mobile Cards */}
      {isLoading ? (
        <div className="space-y-2 border rounded-lg p-3 bg-card">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <div className="border rounded-lg p-6 text-center bg-card space-y-2">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
          <p className="text-xs font-medium text-foreground">
            Could not load, tap to retry
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="h-8 text-xs gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tap to retry
          </Button>
        </div>
      ) : filtered.rowsNewestFirst.length === 0 ? (
        <div className="border rounded-lg p-8 text-center bg-card space-y-2">
          <FileText className="w-7 h-7 text-muted-foreground/60 mx-auto" />
          <p className="text-xs font-medium text-foreground">
            {ledger.entriesNewestFirst.length === 0
              ? "No transactions yet"
              : "No matching entries found"}
          </p>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-7 text-xs cursor-pointer"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop / Tablet Table */}
          <div className="hidden md:block border rounded-lg overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-muted/60 text-muted-foreground border-b">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Date</th>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">Type</th>
                    <th className="text-left font-semibold px-3 py-2 whitespace-nowrap">
                      Reference
                    </th>
                    <th className="text-left font-semibold px-3 py-2">Description</th>
                    <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Debit</th>
                    <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">Credit</th>
                    <th className="text-right font-semibold px-3 py-2 whitespace-nowrap">
                      Running Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {visibleRows.map((row) => {
                    const isClickable = Boolean(
                      (row.sourceKind === "invoice" || row.sourceKind === "voucher") &&
                        row.sourceRecord
                    );
                    return (
                      <tr
                        key={row.id}
                        onClick={() => isClickable && handleRowClick(row)}
                        className={
                          isClickable
                            ? "hover:bg-muted/40 cursor-pointer transition-colors"
                            : "hover:bg-muted/20"
                        }
                      >
                        <td className="px-3 py-2 font-mono whitespace-nowrap text-muted-foreground">
                          {row.date || "—"}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium border ${
                              row.category === "invoice"
                                ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                : row.category === "payment"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                : row.category === "void" || row.category === "refund"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {row.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                          <span className={isClickable ? "text-primary hover:underline" : ""}>
                            {row.reference}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[260px] truncate">
                          {row.description || "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                          {row.debit > 0 ? row.debit.toLocaleString() : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono whitespace-nowrap">
                          {row.credit > 0 ? row.credit.toLocaleString() : "—"}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono font-bold whitespace-nowrap ${
                            row.balanceDrCr === "DR"
                              ? "text-red-600 dark:text-red-400"
                              : row.balanceDrCr === "CR"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-foreground"
                          }`}
                        >
                          {row.balanceFormatted}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-muted/50 border-t font-semibold text-xs">
                  <tr>
                    <td colSpan={4} className="px-3 py-2.5 text-right text-muted-foreground">
                      Totals ({filtered.rowsNewestFirst.length} entries)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      PKR {filtered.totalDebit.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                      PKR {filtered.totalCredit.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold whitespace-nowrap">
                      {formatDrCrAmount(filtered.closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mobile Card Layout */}
          <div className="md:hidden space-y-2">
            {visibleRows.map((row) => {
              const isClickable = Boolean(
                (row.sourceKind === "invoice" || row.sourceKind === "voucher") &&
                  row.sourceRecord
              );
              return (
                <div
                  key={row.id}
                  onClick={() => isClickable && handleRowClick(row)}
                  className={`border rounded-lg p-3 bg-card space-y-1.5 text-xs ${
                    isClickable ? "cursor-pointer active:bg-muted/40" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {row.date || "—"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-muted text-foreground">
                      {row.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-mono font-semibold ${
                        isClickable ? "text-primary underline-offset-2 underline" : ""
                      }`}
                    >
                      {row.reference}
                    </span>
                    <span
                      className={`font-mono font-bold ${
                        row.balanceDrCr === "DR"
                          ? "text-red-600 dark:text-red-400"
                          : row.balanceDrCr === "CR"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      }`}
                    >
                      {row.balanceFormatted}
                    </span>
                  </div>
                  {row.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {row.description}
                    </p>
                  )}
                  {(row.debit > 0 || row.credit > 0) && (
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50 font-mono">
                      <span className="text-muted-foreground">
                        Dr: {row.debit > 0 ? `PKR ${row.debit.toLocaleString()}` : "—"}
                      </span>
                      <span className="text-muted-foreground">
                        Cr: {row.credit > 0 ? `PKR ${row.credit.toLocaleString()}` : "—"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Mobile Totals Summary */}
            <div className="border rounded-lg p-3 bg-muted/40 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Debit</span>
                <span className="font-mono font-semibold">
                  PKR {filtered.totalDebit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Credit</span>
                <span className="font-mono font-semibold">
                  PKR {filtered.totalCredit.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t font-bold">
                <span>Closing Balance</span>
                <span className="font-mono">
                  {formatDrCrAmount(filtered.closingBalance)}
                </span>
              </div>
            </div>
          </div>

          {/* Load more button (loads 100 rows at a time) */}
          {remainingRowsCount > 0 && (
            <div className="flex justify-center pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setVisibleLimit((prev) => prev + PAGE_SIZE)}
                className="h-8 text-xs cursor-pointer"
              >
                Load more ({remainingRowsCount} more)
              </Button>
            </div>
          )}
        </>
      )}

      {/* Quiet Deactivate / Activate Party option at the bottom */}
      {onToggleActive && !party.isLegacyRecord && (
        <div className="pt-4 border-t flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Account status</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isUpdatingStatus}
            onClick={() => setConfirmToggleOpen(true)}
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-red-600 cursor-pointer"
          >
            {party.active === false ? "Activate Party" : "Deactivate Party"}
          </Button>
        </div>
      )}

      {/* Confirmation dialog for Deactivate / Activate Party */}
      <AlertDialog open={confirmToggleOpen} onOpenChange={setConfirmToggleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {party.active === false ? `Activate ${party.name}?` : `Deactivate ${party.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {party.active === false
                ? "This party will appear again in selectors when creating new invoices or payment vouchers."
                : "All existing bookings, vouchers, and ledger entries will remain untouched. You can reactivate this party at any time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggleStatus}
              className={
                party.active === false
                  ? "cursor-pointer"
                  : "bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              }
            >
              {party.active === false ? "Activate Party" : "Deactivate Party"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Statement Dialog (with period choice) */}
      <SendStatementDialog
        open={isStatementOpen}
        onOpenChange={setIsStatementOpen}
        party={party}
        ledger={ledger}
        initialCustomFrom={statementPrefillDates.from}
        initialCustomTo={statementPrefillDates.to}
      />

      {/* Read-only quick viewers on ledger row click */}
      <InvoiceQuickViewDialog
        invoice={inspectedInvoice}
        onClose={() => setInspectedInvoice(null)}
        fallbackPartyName={party.name}
      />
      <VoucherQuickViewDialog
        voucher={inspectedVoucher}
        onClose={() => setInspectedVoucher(null)}
        fallbackPartyName={party.name}
      />
    </div>
  );
};

