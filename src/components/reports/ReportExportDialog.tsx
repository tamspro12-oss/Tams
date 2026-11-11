import React, { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Search,
  Check,
  CheckSquare,
  Square,
  Users,
  Loader2,
  AlertCircle,
  ExternalLink,
  Calendar,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subDays,
  parseISO,
} from "date-fns";
import {
  generateAccountStatementPdf,
  generateBookingReportPdf,
  generateDailyReportPdf,
  generateFinancialReportsPdf,
  sanitizeFilename,
  AgencyInfo,
  StatementRow,
  BookingRow,
  DailyReportRow,
  AccountSummaryRow,
  AssetDueRow,
  MonthlyFigureRow,
  FinancialPnlData,
} from "@/lib/reportPdfGenerator";

export type ReportTab = "daily-report" | "account-statement" | "booking-report" | "financial-reports";
export type DatePreset = "today" | "yesterday" | "this_month" | "last_month" | "this_year" | "all" | "custom";

export interface ReportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportTab: ReportTab;
  agency?: AgencyInfo;
  parties: any[];
  accounts: any[];
  // Raw Data passed from page to preserve single source of truth
  rawInvoices: any[];
  rawExpenses: any[];
  rawTransactions: any[];
  rawStatementData: StatementRow[];
  financialSubReport?: "pnl" | "accounts_summary" | "assets_dues" | "monthly_income" | "monthly_expenses";
  // Initial page settings to mirror defaults
  initialDateRange?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialPartyId?: string;
  initialDetailedView?: boolean;
  initialOnlyUnpaid?: boolean;
  initialOverdueBucket?: string;
  quotationSummary?: {
    totalQuotes: number;
    acceptedQuotes: number;
    convertedQuotes: number;
    conversionRate: number;
  };
}

export const ReportExportDialog: React.FC<ReportExportDialogProps> = ({
  open,
  onOpenChange,
  reportTab,
  agency,
  parties = [],
  accounts = [],
  rawInvoices = [],
  rawExpenses = [],
  rawTransactions = [],
  rawStatementData = [],
  financialSubReport = "pnl",
  initialDateRange = "this_month",
  initialStartDate = "",
  initialEndDate = "",
  initialPartyId = "all",
  initialDetailedView = false,
  initialOnlyUnpaid = false,
  initialOverdueBucket = "none",
  quotationSummary,
}) => {
  // --------------------------------------------------------------------------
  // 1. DATE RANGE STATE (Synced to defaults on open)
  // --------------------------------------------------------------------------
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    if (open) {
      const now = new Date();
      if (initialDateRange === "today") {
        setDatePreset("today");
        setFromDate(format(now, "yyyy-MM-dd"));
        setToDate(format(now, "yyyy-MM-dd"));
      } else if (initialDateRange === "last_month") {
        setDatePreset("last_month");
        const lm = subMonths(now, 1);
        setFromDate(format(startOfMonth(lm), "yyyy-MM-dd"));
        setToDate(format(endOfMonth(lm), "yyyy-MM-dd"));
      } else if (initialDateRange === "all") {
        setDatePreset("all");
        setFromDate("");
        setToDate("");
      } else if (initialDateRange === "custom" && initialStartDate && initialEndDate) {
        setDatePreset("custom");
        setFromDate(initialStartDate);
        setToDate(initialEndDate);
      } else {
        setDatePreset("this_month");
        setFromDate(format(startOfMonth(now), "yyyy-MM-dd"));
        setToDate(format(endOfMonth(now), "yyyy-MM-dd"));
      }
    }
  }, [open, initialDateRange, initialStartDate, initialEndDate]);

  const handlePresetChange = (preset: DatePreset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === "today") {
      const str = format(now, "yyyy-MM-dd");
      setFromDate(str);
      setToDate(str);
    } else if (preset === "yesterday") {
      const yest = subDays(now, 1);
      const str = format(yest, "yyyy-MM-dd");
      setFromDate(str);
      setToDate(str);
    } else if (preset === "this_month") {
      setFromDate(format(startOfMonth(now), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(now), "yyyy-MM-dd"));
    } else if (preset === "last_month") {
      const lm = subMonths(now, 1);
      setFromDate(format(startOfMonth(lm), "yyyy-MM-dd"));
      setToDate(format(endOfMonth(lm), "yyyy-MM-dd"));
    } else if (preset === "this_year") {
      setFromDate(format(startOfYear(now), "yyyy-MM-dd"));
      setToDate(format(endOfYear(now), "yyyy-MM-dd"));
    } else if (preset === "all") {
      setFromDate("");
      setToDate("");
    }
  };

  const isDateInvalid = useMemo(() => {
    if (datePreset === "all") return false;
    if (datePreset === "custom" && (!fromDate || !toDate)) return true;
    if (fromDate && toDate && fromDate > toDate) return true;
    return false;
  }, [datePreset, fromDate, toDate]);

  // --------------------------------------------------------------------------
  // 2. REPORT FILTERS
  // --------------------------------------------------------------------------
  // Party Selector (Multi-select)
  const [selectedPartyIds, setSelectedPartyIds] = useState<string[]>([]);
  const [partySearchQuery, setPartySearchQuery] = useState("");
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialPartyId && initialPartyId !== "all") {
        setSelectedPartyIds([initialPartyId]);
      } else {
        setSelectedPartyIds([]); // empty means All Parties
      }
    }
  }, [open, initialPartyId]);

  // Account Statement options
  const [separateParties, setSeparateParties] = useState<boolean>(false);
  const [detailedView, setDetailedView] = useState<boolean>(initialDetailedView);
  const [onlyUnpaid, setOnlyUnpaid] = useState<boolean>(initialOnlyUnpaid);
  const [overdueBucket, setOverdueBucket] = useState<string>(initialOverdueBucket);
  const [selectedEntryTypes, setSelectedEntryTypes] = useState<string[]>(["Sale", "Payment", "Refund", "Expense"]);
  const [selectedServices, setSelectedServices] = useState<string[]>(["Ticket", "Umrah", "Visa", "Hotel", "Insurance", "Other"]);

  // Booking Report options
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["Paid", "Partial", "Pending"]);
  const [includeProfitColumns, setIncludeProfitColumns] = useState<boolean>(true);
  const [includeQuoteSummary, setIncludeQuoteSummary] = useState<boolean>(true);

  // Daily Report options
  const [dailyAccountFilter, setDailyAccountFilter] = useState<string>("all");
  const [dailyEntryType, setDailyEntryType] = useState<string>("all");

  // Financial Reports options
  const [selectedFinSubReport, setSelectedFinSubReport] = useState<string>(financialSubReport);
  useEffect(() => {
    if (open && financialSubReport) {
      setSelectedFinSubReport(financialSubReport);
    }
  }, [open, financialSubReport]);

  // UI state
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [lastExportedParty, setLastExportedParty] = useState<{ name: string; phone?: string } | null>(null);

  // Categorized Parties
  const clientParties = useMemo(() => parties.filter((p) => p.type === "client" || p.type === "both"), [parties]);
  const vendorParties = useMemo(() => parties.filter((p) => p.type === "vendor" || p.type === "both"), [parties]);

  const filteredClientParties = useMemo(() => {
    if (!partySearchQuery.trim()) return clientParties;
    const q = partySearchQuery.toLowerCase();
    return clientParties.filter((p) => p.name?.toLowerCase().includes(q) || p.phone?.includes(q));
  }, [clientParties, partySearchQuery]);

  const filteredVendorParties = useMemo(() => {
    if (!partySearchQuery.trim()) return vendorParties;
    const q = partySearchQuery.toLowerCase();
    return vendorParties.filter((p) => p.name?.toLowerCase().includes(q) || p.phone?.includes(q));
  }, [vendorParties, partySearchQuery]);

  const togglePartyId = (id: string) => {
    setSelectedPartyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAllParties = () => {
    setSelectedPartyIds(parties.map((p) => p.id));
  };

  const clearParties = () => {
    setSelectedPartyIds([]);
  };

  // Helper date checker
  const isDateInRange = (dateStr?: string) => {
    if (datePreset === "all") return true;
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  // --------------------------------------------------------------------------
  // 3. LIVE RECORD COUNT COMPUTATION & PREVIEWS
  // --------------------------------------------------------------------------
  const preview = useMemo(() => {
    if (isDateInvalid) {
      return { count: 0, text: "Invalid date range (From date must not be after To date)", isValid: false };
    }

    const periodStr =
      datePreset === "all"
        ? "All Time"
        : fromDate && toDate
        ? `${format(parseISO(fromDate), "dd MMM yyyy")} to ${format(parseISO(toDate), "dd MMM yyyy")}`
        : "Selected Period";

    if (reportTab === "account-statement") {
      let filtered = rawStatementData.filter((r) => isDateInRange(r.date));
      if (selectedPartyIds.length > 0) {
        filtered = filtered.filter((r) => r.party_id && selectedPartyIds.includes(r.party_id));
      }
      if (onlyUnpaid) {
        filtered = filtered.filter((r) => r.is_unpaid);
      }
      if (overdueBucket && overdueBucket !== "none") {
        filtered = filtered.filter((r) => {
          if (overdueBucket === "all") return r.overdue_status && r.overdue_status.includes("Overdue");
          return r.overdue_status === overdueBucket;
        });
      }
      if (selectedEntryTypes.length > 0) {
        filtered = filtered.filter((r) => selectedEntryTypes.includes(r.entry_type));
      }
      if (selectedServices.length > 0) {
        filtered = filtered.filter((r) => !r.service || selectedServices.includes(r.service));
      }

      const partiesCount = selectedPartyIds.length > 0 ? selectedPartyIds.length : "All";
      if (filtered.length === 0) {
        return { count: 0, text: "No records for this selection", isValid: false };
      }
      return {
        count: filtered.length,
        text: `${filtered.length} records, ${partiesCount} parties, ${periodStr}`,
        isValid: true,
      };
    }

    if (reportTab === "booking-report") {
      let filtered = rawInvoices.filter((inv) => isDateInRange(inv.invoice_date || inv.created_at));
      if (selectedPartyIds.length > 0) {
        filtered = filtered.filter((inv) => inv.party_id && selectedPartyIds.includes(inv.party_id));
      }
      if (selectedServices.length > 0) {
        filtered = filtered.filter((inv) => selectedServices.includes(inv.service || "Ticket"));
      }
      if (selectedStatuses.length > 0) {
        filtered = filtered.filter((inv) => selectedStatuses.includes(inv.payment_status || "Pending"));
      }
      if (filtered.length === 0) {
        return { count: 0, text: "No records for this selection", isValid: false };
      }
      return {
        count: filtered.length,
        text: `${filtered.length} bookings, ${periodStr}`,
        isValid: true,
      };
    }

    if (reportTab === "daily-report") {
      const recs = rawTransactions.filter(
        (t) => (t.type === "payment_in" || t.direction === "received") && isDateInRange(t.date)
      );
      const pmts = rawTransactions.filter(
        (t) => (t.type === "payment_out" || t.direction === "paid") && isDateInRange(t.date)
      );
      const total = recs.length + pmts.length;
      if (total === 0) {
        return { count: 0, text: "No records for this selection", isValid: false };
      }
      return {
        count: total,
        text: `${total} daily transactions (${recs.length} in, ${pmts.length} out), ${periodStr}`,
        isValid: true,
      };
    }

    if (reportTab === "financial-reports") {
      const invCount = rawInvoices.filter((i) => isDateInRange(i.invoice_date)).length;
      const expCount = rawExpenses.filter((e) => isDateInRange(e.expense_date)).length;
      const count = invCount + expCount;
      return {
        count,
        text: `${invCount} sales invoices, ${expCount} expense records, ${periodStr}`,
        isValid: true,
      };
    }

    return { count: 1, text: periodStr, isValid: true };
  }, [
    reportTab,
    isDateInvalid,
    datePreset,
    fromDate,
    toDate,
    rawStatementData,
    rawInvoices,
    rawExpenses,
    rawTransactions,
    selectedPartyIds,
    onlyUnpaid,
    overdueBucket,
    selectedEntryTypes,
    selectedServices,
    selectedStatuses,
  ]);

  // Report Title string
  const reportTitleName = useMemo(() => {
    if (reportTab === "daily-report") return "Daily Report (Day Book)";
    if (reportTab === "account-statement") return "Account Statement";
    if (reportTab === "booking-report") return "Booking Report (Profit)";
    if (reportTab === "financial-reports") {
      if (selectedFinSubReport === "pnl") return "Financial Reports - Profit & Loss";
      if (selectedFinSubReport === "accounts_summary") return "Financial Reports - Accounts Summary";
      if (selectedFinSubReport === "assets_dues") return "Financial Reports - Assets & Dues";
      if (selectedFinSubReport === "monthly_income") return "Financial Reports - Monthly Income";
      if (selectedFinSubReport === "monthly_expenses") return "Financial Reports - Monthly Expenses";
      return "Financial Reports";
    }
    return "Report";
  }, [reportTab, selectedFinSubReport]);

  // --------------------------------------------------------------------------
  // 4. PDF EXPORT HANDLER
  // --------------------------------------------------------------------------
  const handleExport = async () => {
    if (!preview.isValid || preview.count === 0) {
      toast.error("No records found for the selected filters");
      return;
    }

    setIsExporting(true);
    setLastExportedParty(null);

    try {
      const agencyName = agency?.name || "TAMS";
      const periodText =
        datePreset === "all"
          ? "All Time"
          : fromDate && toDate
          ? `${format(parseISO(fromDate), "dd MMM yyyy")} to ${format(parseISO(toDate), "dd MMM yyyy")}`
          : "Period";

      const fromSlug = fromDate || "All";
      const toSlug = toDate || "Time";

      // ----------------------------------------------------------------------
      // EXPORT 1: ACCOUNT STATEMENT
      // ----------------------------------------------------------------------
      if (reportTab === "account-statement") {
        let filtered = rawStatementData.filter((r) => isDateInRange(r.date));
        if (selectedPartyIds.length > 0) {
          filtered = filtered.filter((r) => r.party_id && selectedPartyIds.includes(r.party_id));
        }
        if (onlyUnpaid) {
          filtered = filtered.filter((r) => r.is_unpaid);
        }
        if (overdueBucket && overdueBucket !== "none") {
          filtered = filtered.filter((r) => {
            if (overdueBucket === "all") return r.overdue_status && r.overdue_status.includes("Overdue");
            return r.overdue_status === overdueBucket;
          });
        }
        if (selectedEntryTypes.length > 0) {
          filtered = filtered.filter((r) => selectedEntryTypes.includes(r.entry_type));
        }
        if (selectedServices.length > 0) {
          filtered = filtered.filter((r) => !r.service || selectedServices.includes(r.service));
        }

        const selectedPartyObjs =
          selectedPartyIds.length > 0
            ? parties
                .filter((p) => selectedPartyIds.includes(p.id))
                .map((p) => ({
                  id: p.id,
                  name: p.name,
                  phone: p.phone,
                  type: p.type,
                  opening_balance: Number(p.opening_balance) || 0,
                }))
            : [{ id: "all", name: "All Parties", phone: undefined, type: undefined, opening_balance: 0 }];

        const partySlug =
          selectedPartyObjs.length === 1 ? sanitizeFilename(selectedPartyObjs[0].name) : "All_Parties";

        const doc = generateAccountStatementPdf({
          agency,
          periodText,
          fromIso: fromDate,
          toIso: toDate,
          rows: filtered,
          selectedParties: selectedPartyObjs,
          separateParties: separateParties && selectedPartyObjs.length > 1,
          detailedJournalLines: detailedView,
          onlyUnpaid,
        });

        const filename = `${sanitizeFilename(agencyName)}_AccountStatement_${partySlug}_${fromSlug}_to_${toSlug}.pdf`;
        doc.save(filename);

        if (selectedPartyObjs.length === 1 && selectedPartyObjs[0].id !== "all") {
          setLastExportedParty({
            name: selectedPartyObjs[0].name,
            phone: selectedPartyObjs[0].phone,
          });
        }

        toast.success("Account statement exported successfully");
      }

      // ----------------------------------------------------------------------
      // EXPORT 2: BOOKING REPORT
      // ----------------------------------------------------------------------
      else if (reportTab === "booking-report") {
        let filtered = rawInvoices.filter((inv) => isDateInRange(inv.invoice_date || inv.created_at));
        if (selectedPartyIds.length > 0) {
          filtered = filtered.filter((inv) => inv.party_id && selectedPartyIds.includes(inv.party_id));
        }
        if (selectedServices.length > 0) {
          filtered = filtered.filter((inv) => selectedServices.includes(inv.service || "Ticket"));
        }
        if (selectedStatuses.length > 0) {
          filtered = filtered.filter((inv) => selectedStatuses.includes(inv.payment_status || "Pending"));
        }

        const bookingRows: BookingRow[] = filtered.map((inv) => {
          const selling = Number(inv.client_amount) || Number(inv.amount) || 0;
          const cost = Number(inv.vendor_payable) || Number(inv.purchasing_price) || 0;
          return {
            invoice_no: inv.invoice_no || inv.invoice_number || `INV-${inv.id?.slice(0, 4)}`,
            invoice_date: inv.invoice_date || inv.created_at?.slice(0, 10) || "—",
            client_name: inv.party?.name || inv.client_name || inv.client?.name || "Client",
            vendor_name: inv.vendor?.name,
            service: inv.service || inv.travel_type || "Booking",
            sector_or_pnr: inv.pnr || inv.sector || inv.item_description || "—",
            client_amount: selling,
            vendor_payable: cost,
            profit: selling - cost,
            status: inv.payment_status || "Active",
          };
        });

        const partySlug =
          selectedPartyIds.length === 1
            ? sanitizeFilename(parties.find((p) => p.id === selectedPartyIds[0])?.name || "Party")
            : "All";

        const doc = generateBookingReportPdf({
          agency,
          periodText,
          rows: bookingRows,
          includeProfit: includeProfitColumns,
          includeQuotationConversion: includeQuoteSummary,
          quotationSummary,
        });

        const filename = `${sanitizeFilename(agencyName)}_BookingReport_${partySlug}_${fromSlug}_to_${toSlug}.pdf`;
        doc.save(filename);
        toast.success("Booking report exported successfully");
      }

      // ----------------------------------------------------------------------
      // EXPORT 3: DAILY REPORT (DAY BOOK)
      // ----------------------------------------------------------------------
      else if (reportTab === "daily-report") {
        let receipts: DailyReportRow[] = rawTransactions
          .filter((t) => (t.type === "payment_in" || t.direction === "received") && isDateInRange(t.date))
          .map((t) => ({
            id: t.id,
            date: t.date || "—",
            reference_no: t.reference_no || `REC-${t.id?.slice(0, 4)}`,
            type: "inflow",
            party_name: t.party_name || t.notes || "Receipt",
            method: t.method || "Cash",
            amount: Number(t.debit || t.amount || 0),
          }));

        let payments: DailyReportRow[] = rawTransactions
          .filter((t) => (t.type === "payment_out" || t.direction === "paid") && isDateInRange(t.date))
          .map((t) => ({
            id: t.id,
            date: t.date || "—",
            reference_no: t.reference_no || `PMT-${t.id?.slice(0, 4)}`,
            type: "outflow",
            party_name: t.party_name || t.category || t.notes || "Disbursement",
            method: t.method || "Cash",
            amount: Number(t.credit || t.amount || 0),
          }));

        if (dailyAccountFilter === "cash") {
          receipts = receipts.filter((r) => r.method?.toLowerCase() === "cash");
          payments = payments.filter((p) => p.method?.toLowerCase() === "cash");
        } else if (dailyAccountFilter === "bank") {
          receipts = receipts.filter((r) => r.method?.toLowerCase() !== "cash");
          payments = payments.filter((p) => p.method?.toLowerCase() !== "cash");
        }

        if (dailyEntryType === "receipts") payments = [];
        if (dailyEntryType === "payments") receipts = [];

        const doc = generateDailyReportPdf({
          agency,
          periodText,
          receipts,
          payments,
          openingBalance: 0,
          accountType: dailyAccountFilter === "all" ? "Cash & Bank" : dailyAccountFilter.toUpperCase(),
        });

        const filename = `${sanitizeFilename(agencyName)}_DailyReport_${fromSlug}_to_${toSlug}.pdf`;
        doc.save(filename);
        toast.success("Daily report exported successfully");
      }

      // ----------------------------------------------------------------------
      // EXPORT 4: FINANCIAL REPORTS
      // ----------------------------------------------------------------------
      else if (reportTab === "financial-reports") {
        const filteredInvoices = rawInvoices.filter((i) => isDateInRange(i.invoice_date || i.created_at));
        const filteredExpenses = rawExpenses.filter((e) => isDateInRange(e.expense_date || e.created_at));

        const rev = filteredInvoices.reduce((s, i) => s + (Number(i.client_amount) || Number(i.amount) || 0), 0);
        const cost = filteredInvoices.reduce((s, i) => s + (Number(i.vendor_payable) || Number(i.purchasing_price) || 0), 0);
        const gp = rev - cost;
        const exp = filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const ref = 0; // refunds in period
        const net = gp - exp - ref;

        // Categorize expenses
        const expMap: Record<string, number> = {};
        filteredExpenses.forEach((e) => {
          const cat = e.expense_type || "General";
          expMap[cat] = (expMap[cat] || 0) + (Number(e.amount) || 0);
        });
        const expenseBreakdown = Object.entries(expMap).map(([category, amount]) => ({ category, amount }));

        const pnlData: FinancialPnlData = {
          grossRevenue: rev,
          costOfSales: cost,
          grossProfit: gp,
          operatingExpenses: exp,
          refunds: ref,
          netCleanProfit: net,
          expenseBreakdown,
        };

        const accountsData: AccountSummaryRow[] = accounts.map((acc) => ({
          account_name: acc.account_name || acc.name,
          account_type: acc.account_type || acc.type || "Bank",
          opening_balance: Number(acc.opening_balance) || 0,
          total_debit: Number(acc.current_balance) || 0,
          total_credit: 0,
          closing_balance: Number(acc.current_balance) || 0,
        }));

        const assetsDuesData: AssetDueRow[] = [
          ...accounts.map((acc) => ({
            category: "Cash & Bank" as const,
            name: acc.account_name || acc.name,
            amount: Number(acc.current_balance) || 0,
          })),
          ...parties
            .filter((p) => (Number(p.current_balance) || 0) > 0)
            .map((p) => ({
              category: "Client Receivable" as const,
              name: p.name,
              amount: Number(p.current_balance) || 0,
            })),
          ...parties
            .filter((p) => (Number(p.current_balance) || 0) < 0)
            .map((p) => ({
              category: "Vendor Payable" as const,
              name: p.name,
              amount: Math.abs(Number(p.current_balance) || 0),
            })),
        ];

        const doc = generateFinancialReportsPdf({
          agency,
          periodText,
          subReport: selectedFinSubReport as any,
          asOfDateText: toDate ? `As of ${format(parseISO(toDate), "dd MMM yyyy")}` : "As of Today",
          pnlData,
          accountsData,
          assetsDuesData,
        });

        const filename = `${sanitizeFilename(agencyName)}_Financial_${selectedFinSubReport}_${fromSlug}_to_${toSlug}.pdf`;
        doc.save(filename);
        toast.success("Financial report exported successfully");
      }
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error(`Could not export PDF: ${err.message || "Unknown error"}`);
    } finally {
      setIsExporting(false);
    }
  };

  // WhatsApp share link
  const whatsappUrl = useMemo(() => {
    if (!lastExportedParty || !lastExportedParty.phone) return null;
    const cleanPhone = lastExportedParty.phone.replace(/[^0-9]/g, "");
    if (!cleanPhone) return null;

    const periodStr =
      datePreset === "all"
        ? "All Time"
        : fromDate && toDate
        ? `${format(parseISO(fromDate), "dd MMM yyyy")} to ${format(parseISO(toDate), "dd MMM yyyy")}`
        : "the requested period";

    const msg = `Dear ${lastExportedParty.name}, please find your account statement from ${agency?.name || "our agency"} for ${periodStr}. Thank you!`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  }, [lastExportedParty, agency, datePreset, fromDate, toDate]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background border border-border shadow-2xl rounded-xl">
        {/* HEADER: Title & Close */}
        <DialogHeader className="px-5 py-3 border-b shrink-0 bg-muted/30">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm sm:text-base font-bold flex items-center gap-2 text-foreground">
              <FileText className="w-4 h-4 text-rose-600" />
              <span>Export PDF — {reportTitleName}</span>
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* BODY: Compact controls without redundant section headings */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* 1. Date Range Row */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Date Range
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Select value={datePreset} onValueChange={(v) => handlePresetChange(v as DatePreset)}>
                <SelectTrigger className="h-8 text-xs font-medium">
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_month">Last Month</SelectItem>
                  <SelectItem value="this_year">This Year</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>

              {datePreset === "custom" ? (
                <>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="h-8 text-xs"
                    title="From Date"
                  />
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="h-8 text-xs"
                    title="To Date"
                  />
                </>
              ) : (
                <div className="sm:col-span-2 flex items-center px-3 py-1 bg-muted/40 rounded border text-muted-foreground text-[11px] font-mono truncate">
                  <Calendar className="w-3.5 h-3.5 mr-1.5 shrink-0 text-slate-400" />
                  {datePreset === "all" ? "All Time" : `${fromDate || "—"} to ${toDate || "—"}`}
                </div>
              )}
            </div>
            {isDateInvalid && (
              <p className="text-[11px] text-rose-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                From date must not be after To date.
              </p>
            )}
          </div>

          {/* 2. TAB-SPECIFIC FILTERS */}

          {/* ----------------- ACCOUNT STATEMENT FILTERS ----------------- */}
          {reportTab === "account-statement" && (
            <div className="space-y-3 pt-1">
              {/* Party Multi-Select */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Parties ({selectedPartyIds.length === 0 ? "All Parties Selected" : `${selectedPartyIds.length} Selected`})
                  </Label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllParties}
                      className="text-blue-600 hover:underline font-medium cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-muted-foreground">•</span>
                    <button
                      type="button"
                      onClick={clearParties}
                      className="text-slate-500 hover:underline font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Searchable Dropdown Button / Sheet */}
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPartyDropdownOpen(!partyDropdownOpen)}
                    className="w-full justify-between h-8 text-xs font-normal"
                  >
                    <span className="truncate">
                      {selectedPartyIds.length === 0
                        ? "All Parties (Clients & Vendors)"
                        : selectedPartyIds.length === 1
                        ? parties.find((p) => p.id === selectedPartyIds[0])?.name || "1 party selected"
                        : `${selectedPartyIds.length} parties selected`}
                    </span>
                    <span className="text-[10px] text-muted-foreground">▼</span>
                  </Button>

                  {partyDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 top-9 bg-card border rounded-lg shadow-xl p-2 space-y-2 max-h-56 flex flex-col">
                      <div className="relative shrink-0">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-muted-foreground" />
                        <Input
                          placeholder="Search client or vendor..."
                          value={partySearchQuery}
                          onChange={(e) => setPartySearchQuery(e.target.value)}
                          className="h-7 pl-7 text-xs"
                        />
                      </div>

                      <div className="overflow-y-auto space-y-2 flex-1 text-xs">
                        {/* Clients Group */}
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5">
                            Clients ({filteredClientParties.length})
                          </div>
                          {filteredClientParties.map((c) => {
                            const isChecked = selectedPartyIds.includes(c.id);
                            return (
                              <div
                                key={c.id}
                                onClick={() => togglePartyId(c.id)}
                                className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  {isChecked ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                  <span className="truncate font-medium">{c.name}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{c.phone || "No phone"}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Vendors Group */}
                        <div>
                          <div className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5">
                            Vendors ({filteredVendorParties.length})
                          </div>
                          {filteredVendorParties.map((v) => {
                            const isChecked = selectedPartyIds.includes(v.id);
                            return (
                              <div
                                key={v.id}
                                onClick={() => togglePartyId(v.id)}
                                className="flex items-center justify-between px-2 py-1 rounded hover:bg-muted cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  {isChecked ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                  <span className="truncate font-medium">{v.name}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">{v.city || "Supplier"}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-1 border-t flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPartyDropdownOpen(false)}
                          className="h-6 text-[11px] px-2"
                        >
                          Done
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Multi-party Layout Question (When 2+ parties are chosen) */}
              {selectedPartyIds.length > 1 && (
                <div className="p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 space-y-1.5">
                  <span className="text-[11px] font-semibold text-blue-900 dark:text-blue-200">
                    Multiple parties selected. How should the statement be exported?
                  </span>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="separate"
                        checked={!separateParties}
                        onChange={() => setSeparateParties(false)}
                        className="text-blue-600"
                      />
                      <span>One combined master statement</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="separate"
                        checked={separateParties}
                        onChange={() => setSeparateParties(true)}
                        className="text-blue-600"
                      />
                      <span>
                        Separate statement for each party (one PDF, each party starts on a new page)
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {/* Toggles & Overdue */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detailedView}
                    onChange={(e) => setDetailedView(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Detailed journal lines</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyUnpaid}
                    onChange={(e) => setOnlyUnpaid(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Only unpaid invoices</span>
                </label>
              </div>

              {/* Overdue Bucket */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-muted-foreground font-medium">Overdue Filter:</span>
                <Select value={overdueBucket} onValueChange={setOverdueBucket}>
                  <SelectTrigger className="h-7 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Records</SelectItem>
                    <SelectItem value="all">All Overdue Only</SelectItem>
                    <SelectItem value="0-30">0-30 Days</SelectItem>
                    <SelectItem value="31-60">31-60 Days</SelectItem>
                    <SelectItem value="61-90">61-90 Days</SelectItem>
                    <SelectItem value="90+">90+ Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ----------------- BOOKING REPORT FILTERS ----------------- */}
          {reportTab === "booking-report" && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={includeProfitColumns}
                    onChange={(e) => setIncludeProfitColumns(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>Include profit & cost columns</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={includeQuoteSummary}
                    onChange={(e) => setIncludeQuoteSummary(e.target.checked)}
                    className="rounded text-teal-600"
                  />
                  <span>Include quotation conversion summary</span>
                </label>
              </div>

              {/* Service checklist */}
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase">Services:</span>
                <div className="flex flex-wrap gap-2">
                  {["Ticket", "Umrah", "Visa", "Hotel", "Insurance", "Other"].map((srv) => {
                    const isChecked = selectedServices.includes(srv);
                    return (
                      <button
                        key={srv}
                        type="button"
                        onClick={() =>
                          setSelectedServices((prev) =>
                            isChecked ? prev.filter((s) => s !== srv) : [...prev, srv]
                          )
                        }
                        className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-colors ${
                          isChecked
                            ? "bg-primary/10 border-primary text-primary"
                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                        }`}
                      >
                        {srv}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ----------------- DAILY REPORT FILTERS ----------------- */}
          {reportTab === "daily-report" && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Account Filter</Label>
                  <Select value={dailyAccountFilter} onValueChange={setDailyAccountFilter}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cash & Bank Accounts</SelectItem>
                      <SelectItem value="cash">Cash Accounts Only</SelectItem>
                      <SelectItem value="bank">Bank Accounts Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Entry Filter</Label>
                  <Select value={dailyEntryType} onValueChange={setDailyEntryType}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Receipts & Payments (All)</SelectItem>
                      <SelectItem value="receipts">Receipts (Money In Only)</SelectItem>
                      <SelectItem value="payments">Payments (Money Out Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* ----------------- FINANCIAL REPORTS FILTERS ----------------- */}
          {reportTab === "financial-reports" && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Sub-Report to Export</Label>
                <Select value={selectedFinSubReport} onValueChange={setSelectedFinSubReport}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pnl">1. Profit & Loss Report</SelectItem>
                    <SelectItem value="accounts_summary">2. Accounts Summary</SelectItem>
                    <SelectItem value="assets_dues">3. Assets & Dues</SelectItem>
                    <SelectItem value="monthly_income">4. Monthly Income</SelectItem>
                    <SelectItem value="monthly_expenses">5. Monthly Expenses</SelectItem>
                    <SelectItem value="all">All Financial Reports in One PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* LIVE PREVIEW BADGE */}
          <div
            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
              preview.isValid && preview.count > 0
                ? "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 font-medium"
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold">Live Preview:</span>
              <span className="truncate">{preview.text}</span>
            </div>
          </div>

          {/* WHATSAPP SHARE SECONDARY LINK (Appears when 1 party with phone was exported) */}
          {whatsappUrl && (
            <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 flex items-center justify-between">
              <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">
                Statement ready for {lastExportedParty?.name}!
              </span>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 underline flex items-center gap-1"
              >
                Share on WhatsApp →
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* FOOTER: Cancel and Export PDF only */}
        <DialogFooter className="px-5 py-3 border-t bg-muted/20 shrink-0 flex items-center justify-between sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-medium cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!preview.isValid || preview.count === 0 || isExporting}
            onClick={handleExport}
            className="h-8 px-4 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                <span>Export PDF</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
