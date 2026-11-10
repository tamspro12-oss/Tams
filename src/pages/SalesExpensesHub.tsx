import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ExcelGrid,
  GridColumn,
  PageHeader,
  TotalsBar,
  StatusChip,
  EmptyState,
} from "@/components/design-system";
import { BookingInvoiceForm } from "@/components/bookings/BookingInvoiceForm";
import { PaymentVoucherForm } from "@/components/vouchers/PaymentVoucherForm";
import { RefundVoidForm } from "@/components/refunds/RefundVoidForm";
import { ExpenseFormModal } from "@/components/expenses/ExpenseFormModal";
import { DateFilter, DatePresetFilterValue } from "@/components/DateFilter";
import { isDateWithinPreset } from "@/lib/dateFilterUtils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  generateBookingConfirmationPdf,
  generateBookingInvoicePdf,
} from "@/lib/pdf/bookingInvoicePdf";
import { generateVoucherPdf } from "@/lib/pdf/voucherReceiptPdf";
import {
  FileText,
  CreditCard,
  RotateCcw,
  Receipt,
  Plus,
  Printer,
  FileCheck,
  Search,
  X,
} from "lucide-react";

type SalesTab = "booking-invoice" | "payment-vouchers" | "refunds-voids" | "expenses";

export default function SalesExpensesHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get("tab") as SalesTab) || "booking-invoice";

  // Modals state
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);

  // Filters state for Payment Vouchers
  const [voucherSearch, setVoucherSearch] = useState("");
  const [voucherDateFilter, setVoucherDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  // Filters state for Refunds / Voids
  const [refundSearch, setRefundSearch] = useState("");
  const [refundDateFilter, setRefundDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  // 1. Fetch Invoices
  const { data: invoices = [], refetch: refetchInvoices } = useQuery({
    queryKey: ["booking_invoices"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("booking_invoices")
        .select("*, party:parties(name), vendor:parties!vendor_id(name)")
        .order("invoice_date", { ascending: false });

      if (!error && data && data.length > 0) return data;

      // Fallback: read from clients table
      const { data: clientsData } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      return (clientsData || []).map((c: any) => ({
        id: c.id,
        invoice_no: `INV-${c.id.slice(0, 4).toUpperCase()}`,
        invoice_date: c.flight_date || c.created_at.slice(0, 10),
        service: c.travel_type || "Ticket",
        client_name: c.name,
        party: { name: c.name },
        client_amount: c.selling_price || 0,
        vendor_payable: c.purchasing_price || 0,
        profit: (c.selling_price || 0) - (c.purchasing_price || 0),
        paid_amount: c.amount_paid || 0,
        payment_status: (c.payment_status || "Pending").toLowerCase(),
        pnr: c.pnr,
        ticket_no: c.passport_number,
      }));
    },
  });

  // 2. Fetch Vouchers
  const { data: vouchers = [], refetch: refetchVouchers } = useQuery({
    queryKey: ["payment_vouchers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("payment_vouchers")
        .select("*, party:parties(name)")
        .order("voucher_date", { ascending: false });

      if (!error && data && data.length > 0) return data;

      // Fallback: read from transactions table
      const { data: txData } = await (supabase as any)
        .from("transactions")
        .select("*")
        .in("type", ["payment_in", "payment_out"])
        .order("date", { ascending: false });

      return (txData || []).map((t: any) => ({
        id: t.id,
        voucher_no: t.reference_no || `VCH-${t.id.slice(0, 4).toUpperCase()}`,
        voucher_date: t.date,
        direction: t.type === "payment_in" ? "received" : "paid",
        payment_mode: t.method || "cash",
        amount: t.debit > 0 ? t.debit : t.credit,
        party: { name: t.notes || "Party" },
        reference_no: t.reference_no,
        notes: t.notes,
      }));
    },
  });

  // 3. Fetch Expenses
  const { data: expenses = [], refetch: refetchExpenses } = useQuery({
    queryKey: ["sales_expenses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      return data || [];
    },
  });

  // 4. Fetch Clients Lookup (for refund party / pnr resolution)
  const { data: clientsData = [] } = useQuery({
    queryKey: ["clients_refund_lookup"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, pnr, passport_number");
      return data || [];
    },
  });

  const clientsLookup = useMemo(() => {
    const map: Record<string, { name: string; pnr?: string; passport_number?: string }> = {};
    clientsData.forEach((c: any) => {
      map[c.id] = c;
    });
    return map;
  }, [clientsData]);

  // 5. Fetch Refunds
  const { data: refunds = [], refetch: refetchRefunds } = useQuery({
    queryKey: ["sales_refunds"],
    queryFn: async () => {
      const { data } = await supabase
        .from("refunds")
        .select("*")
        .order("refund_date", { ascending: false });
      return data || [];
    },
  });

  // Helper resolvers for refund party & reference info
  const getRefundPartyName = (r: any) => {
    const client =
      (r.client_id && clientsLookup[r.client_id]) ||
      (r.booking_id && clientsLookup[r.booking_id]);
    if (client?.name) return client.name;
    const match = r.notes?.match(/Party:\s*([^|]+)/);
    if (match) return match[1].trim();
    return "Customer";
  };

  const getRefundRefInfo = (r: any) => {
    const client =
      (r.client_id && clientsLookup[r.client_id]) ||
      (r.booking_id && clientsLookup[r.booking_id]);
    if (client?.pnr) return `PNR: ${client.pnr}`;
    if (client?.passport_number) return `Tkt: ${client.passport_number}`;
    const matchInv = r.notes?.match(/Ref Invoice:\s*([^|]+)/);
    if (matchInv) return matchInv[1].trim();
    if (r.invoice_no) return r.invoice_no;
    return "—";
  };

  // Metrics for active tab
  const totalInvoiced = useMemo(
    () => invoices.reduce((sum: number, inv: any) => sum + (inv.client_amount || 0), 0),
    [invoices]
  );
  const totalProfit = useMemo(
    () => invoices.reduce((sum: number, inv: any) => sum + (inv.profit || 0), 0),
    [invoices]
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0),
    [expenses]
  );

  // Filtered Vouchers (by Search & Date)
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v: any) => {
      // 1. Date Filter (defaults to This Month)
      if (
        !isDateWithinPreset(
          v.voucher_date,
          voucherDateFilter.preset,
          voucherDateFilter.customFrom,
          voucherDateFilter.customTo
        )
      ) {
        return false;
      }

      // 2. Search query live-filter
      if (voucherSearch.trim()) {
        const q = voucherSearch.toLowerCase().trim();
        const matchVoucherNo = (v.voucher_no || "").toLowerCase().includes(q);
        const matchParty = (v.party?.name || "").toLowerCase().includes(q);
        const matchRef = (v.reference_no || "").toLowerCase().includes(q);
        const matchNotes = (v.notes || "").toLowerCase().includes(q);
        const matchMode = (v.payment_mode || "").toLowerCase().includes(q);
        const matchAmount = String(v.amount || "").includes(q);
        const matchTicket = (v.ticket_no || "").toLowerCase().includes(q);
        const matchPnr = (v.pnr || "").toLowerCase().includes(q);

        if (
          !matchVoucherNo &&
          !matchParty &&
          !matchRef &&
          !matchNotes &&
          !matchMode &&
          !matchAmount &&
          !matchTicket &&
          !matchPnr
        ) {
          return false;
        }
      }

      return true;
    });
  }, [vouchers, voucherSearch, voucherDateFilter]);

  // Dynamic summary cards for Vouchers matching search & date
  const filteredTotalReceived = useMemo(
    () =>
      filteredVouchers
        .filter((v: any) => v.direction === "received")
        .reduce((sum: number, v: any) => sum + (v.amount || 0), 0),
    [filteredVouchers]
  );
  const filteredTotalPaidOut = useMemo(
    () =>
      filteredVouchers
        .filter((v: any) => v.direction === "paid")
        .reduce((sum: number, v: any) => sum + (v.amount || 0), 0),
    [filteredVouchers]
  );

  // Filtered Refunds (by Search & Date)
  const filteredRefunds = useMemo(() => {
    return refunds.filter((r: any) => {
      // 1. Date filter (defaults to This Month)
      if (
        !isDateWithinPreset(
          r.refund_date,
          refundDateFilter.preset,
          refundDateFilter.customFrom,
          refundDateFilter.customTo
        )
      ) {
        return false;
      }

      // 2. Search query live-filter
      if (refundSearch.trim()) {
        const q = refundSearch.toLowerCase().trim();
        const refundNo = (
          r.refund_no ||
          r.reference_no ||
          `REF-${r.id.slice(0, 6)}`
        ).toLowerCase();
        const party = getRefundPartyName(r).toLowerCase();
        const refInfo = getRefundRefInfo(r).toLowerCase();
        const reason = (r.reason || "").toLowerCase();
        const mode = (r.payment_mode || "").toLowerCase();
        const notes = (r.notes || "").toLowerCase();
        const amount = String(r.refund_amount || "");

        if (
          !refundNo.includes(q) &&
          !party.includes(q) &&
          !refInfo.includes(q) &&
          !reason.includes(q) &&
          !mode.includes(q) &&
          !notes.includes(q) &&
          !amount.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [refunds, refundSearch, refundDateFilter, clientsLookup]);

  // Dynamic summary cards for Refunds matching search & date
  const filteredTotalRefunds = useMemo(
    () =>
      filteredRefunds.reduce(
        (sum: number, r: any) => sum + (r.refund_amount || 0),
        0
      ),
    [filteredRefunds]
  );

  // Columns for Booking Invoices
  const invoiceColumns: GridColumn[] = [
    {
      key: "invoice_no",
      header: "Invoice #",
      width: 110,
      render: (inv) => (
        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
          {inv.invoice_no}
        </span>
      ),
    },
    {
      key: "invoice_date",
      header: "Date",
      width: 95,
      render: (inv) => <span className="text-xs">{inv.invoice_date}</span>,
    },
    {
      key: "service",
      header: "Service",
      width: 90,
      render: (inv) => (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 border">
          {inv.service}
        </span>
      ),
    },
    {
      key: "client_name",
      header: "Client",
      minWidth: 150,
      render: (inv) => (
        <div>
          <span className="font-semibold block">{inv.party?.name || inv.client_name || "—"}</span>
          {inv.pnr && (
            <span className="text-[10px] text-muted-foreground font-mono">PNR: {inv.pnr}</span>
          )}
        </div>
      ),
    },
    {
      key: "client_amount",
      header: "Amount (PKR)",
      width: 120,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (inv) => (
        <span className="font-mono font-bold">{(inv.client_amount || 0).toLocaleString()}</span>
      ),
    },
    {
      key: "vendor_payable",
      header: "Cost (PKR)",
      width: 110,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (inv) => (
        <span className="font-mono text-slate-500">
          {(inv.vendor_payable || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "profit",
      header: "Profit (PKR)",
      width: 110,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (inv) => {
        const p = inv.profit || 0;
        return (
          <span
            className={`font-mono font-bold ${
              p >= 0 ? "text-teal-600 dark:text-teal-400" : "text-red-500"
            }`}
          >
            {p.toLocaleString()}
          </span>
        );
      },
    },
    {
      key: "payment_status",
      header: "Status",
      width: 85,
      align: "center",
      render: (inv) => <StatusChip status={inv.payment_status} size="sm" />,
    },
    {
      key: "actions",
      header: "PDF",
      width: 90,
      align: "center",
      sortable: false,
      filterable: false,
      render: (inv) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              generateBookingConfirmationPdf({
                invoiceNo: inv.invoice_no,
                invoiceDate: inv.invoice_date,
                service: inv.service,
                clientName: inv.party?.name || inv.client_name || "Client",
                pnr: inv.pnr,
                clientAmount: inv.client_amount || 0,
                paidAmount: inv.paid_amount || 0,
                balanceDue: (inv.client_amount || 0) - (inv.paid_amount || 0),
              });
            }}
            title="Download Confirmation"
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-teal-600"
          >
            <FileCheck className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              generateBookingInvoicePdf({
                invoiceNo: inv.invoice_no,
                invoiceDate: inv.invoice_date,
                service: inv.service,
                clientName: inv.party?.name || inv.client_name || "Client",
                pnr: inv.pnr,
                clientAmount: inv.client_amount || 0,
                paidAmount: inv.paid_amount || 0,
                balanceDue: (inv.client_amount || 0) - (inv.paid_amount || 0),
              });
            }}
            title="Download Invoice"
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  // Columns for Payment Vouchers
  const voucherColumns: GridColumn[] = [
    {
      key: "voucher_no",
      header: "Voucher #",
      width: 120,
      render: (v) => <span className="font-mono font-bold text-xs">{v.voucher_no}</span>,
    },
    {
      key: "voucher_date",
      header: "Date",
      width: 95,
      render: (v) => <span className="text-xs">{v.voucher_date}</span>,
    },
    {
      key: "direction",
      header: "Type",
      width: 95,
      render: (v) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            v.direction === "received"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {v.direction === "received" ? "RECEIPT" : "PAYMENT"}
        </span>
      ),
    },
    {
      key: "party",
      header: "Party / Particulars",
      minWidth: 160,
      render: (v) => (
        <div>
          <span className="font-semibold block">{v.party?.name || "Direct Account"}</span>
          {v.notes && <span className="text-[10px] text-muted-foreground">{v.notes}</span>}
        </div>
      ),
    },
    {
      key: "payment_mode",
      header: "Mode",
      width: 80,
      render: (v) => (
        <span className="text-xs uppercase font-medium">{v.payment_mode || "CASH"}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount (PKR)",
      width: 130,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (v) => (
        <span
          className={`font-mono font-bold ${
            v.direction === "received" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {(v.amount || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "print",
      header: "Print",
      width: 60,
      align: "center",
      sortable: false,
      render: (v) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            generateVoucherPdf({
              voucherNo: v.voucher_no,
              voucherDate: v.voucher_date,
              direction: v.direction,
              paymentMode: v.payment_mode,
              partyName: v.party?.name || "Customer",
              amount: v.amount,
              accountName: `${v.payment_mode.toUpperCase()} Account`,
              notes: v.notes,
            });
          }}
          className="p-1 text-slate-500 hover:text-slate-800"
        >
          <Printer className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  // Columns for Expenses
  const expenseColumns: GridColumn[] = [
    {
      key: "expense_date",
      header: "Date",
      width: 100,
      render: (e) => <span className="text-xs">{e.expense_date}</span>,
    },
    {
      key: "expense_type",
      header: "Category",
      minWidth: 140,
      render: (e) => (
        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
          {e.expense_type}
        </span>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      minWidth: 180,
      render: (e) => <span className="text-xs text-muted-foreground">{e.notes || "—"}</span>,
    },
    {
      key: "amount",
      header: "Amount (PKR)",
      width: 130,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (e) => (
        <span className="font-mono font-bold text-red-600">
          {(e.amount || 0).toLocaleString()}
        </span>
      ),
    },
  ];

  // Columns for Refunds / Voids (Date | Refund No | Invoice / Ticket / PNR | Party Name | Reason | Mode | Amount (PKR))
  const refundColumns: GridColumn[] = [
    {
      key: "refund_date",
      header: "Date",
      width: 95,
      render: (r) => <span className="text-xs">{r.refund_date}</span>,
    },
    {
      key: "refund_no",
      header: "Refund #",
      width: 120,
      render: (r) => (
        <span className="font-mono font-bold text-xs">
          {r.refund_no || r.reference_no || `REF-${r.id.slice(0, 6).toUpperCase()}`}
        </span>
      ),
    },
    {
      key: "ref_info",
      header: "Invoice / Ticket / PNR",
      minWidth: 140,
      render: (r) => <span className="text-xs font-mono">{getRefundRefInfo(r)}</span>,
    },
    {
      key: "party_name",
      header: "Party Name",
      minWidth: 150,
      render: (r) => <span className="text-xs font-semibold">{getRefundPartyName(r)}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      minWidth: 160,
      render: (r) => (
        <div>
          <span className="font-semibold text-xs block">{r.reason || "Refund"}</span>
          {r.notes && (
            <span className="text-[10px] text-muted-foreground line-clamp-1">
              {r.notes}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "payment_mode",
      header: "Mode",
      width: 85,
      render: (r) => (
        <span className="text-xs uppercase font-medium">{r.payment_mode || "CASH"}</span>
      ),
    },
    {
      key: "refund_amount",
      header: "Amount (PKR)",
      width: 130,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (r) => (
        <span className="font-mono font-bold text-purple-600">
          {(r.refund_amount || 0).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SeoHead
        title="Sales & Expenses - TAMS Pro"
        description="Unified hub for booking invoices, receipt and payment vouchers, customer refunds, and operating expenses."
        path="/app/sales-expenses"
      />

      {/* Header with 4 Sub-section Tabs */}
      <PageHeader
        title="Sales & Expenses"
        subtitle="Manage booking invoices, payment vouchers, customer refunds, and operating expenses with automatic double-entry posting."
        actions={
          <div className="flex items-center gap-2">
            {currentTab === "booking-invoice" && (
              <Button
                onClick={() => setIsInvoiceOpen(true)}
                size="sm"
                className="bg-[#0B192C] hover:bg-[#1E3E62] text-white text-xs gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Booking Invoice
              </Button>
            )}
            {currentTab === "payment-vouchers" && (
              <Button
                onClick={() => setIsVoucherOpen(true)}
                size="sm"
                className="bg-[#0B192C] hover:bg-[#1E3E62] text-white text-xs gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Payment Voucher
              </Button>
            )}
            {currentTab === "refunds-voids" && (
              <Button
                onClick={() => setIsRefundOpen(true)}
                size="sm"
                className="bg-[#0B192C] hover:bg-[#1E3E62] text-white text-xs gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                New Refund / Void
              </Button>
            )}
            {currentTab === "expenses" && (
              <Button
                onClick={() => setIsExpenseOpen(true)}
                size="sm"
                className="bg-[#0B192C] hover:bg-[#1E3E62] text-white text-xs gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Record Expense
              </Button>
            )}
          </div>
        }
      />

      {/* 4 Canonical Sub-Tabs */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md pb-2 pt-1 border-b border-border/50">
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-11 p-1 bg-muted/60 border">
            <TabsTrigger
              value="booking-invoice"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              Booking Invoice
            </TabsTrigger>
            <TabsTrigger
              value="payment-vouchers"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-emerald-600" />
              Payment Vouchers
            </TabsTrigger>
            <TabsTrigger
              value="refunds-voids"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-purple-600" />
              Refunds / Voids
            </TabsTrigger>
            <TabsTrigger
              value="expenses"
              className="gap-2 text-xs sm:text-sm font-semibold shrink-0 cursor-pointer"
            >
              <Receipt className="w-4 h-4 text-amber-600" />
              Expenses
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab 1: Booking Invoice */}
      {currentTab === "booking-invoice" && (
        <div className="space-y-4">
          <TotalsBar
            metrics={[
              { label: "Total Invoiced", value: totalInvoiced, prefix: "PKR", highlight: "neutral" },
              { label: "Net Profit", value: totalProfit, prefix: "PKR", highlight: "teal" },
              { label: "Total Bookings", value: invoices.length, highlight: "neutral" },
            ]}
          />
          <ExcelGrid
            id="sales_booking_invoices"
            data={invoices}
            columns={invoiceColumns}
            keyExtractor={(inv) => inv.id}
            title="Booking Invoices Register"
            filename="Booking_Invoices"
            emptyState={
              <EmptyState
                type="empty"
                actionLabel="Create First Booking Invoice"
                onAction={() => setIsInvoiceOpen(true)}
              />
            }
          />
        </div>
      )}

      {/* Tab 2: Payment Vouchers */}
      {currentTab === "payment-vouchers" && (
        <div className="space-y-4">
          {/* Dynamic Summary Cards updated to match search & date filter */}
          <TotalsBar
            metrics={[
              {
                label: "Total Receipts (CRV)",
                value: filteredTotalReceived,
                prefix: "PKR",
                highlight: "emerald",
              },
              {
                label: "Total Payments (CPV)",
                value: filteredTotalPaidOut,
                prefix: "PKR",
                highlight: "red",
              },
              {
                label: "Vouchers Count",
                value: filteredVouchers.length,
                highlight: "neutral",
              },
            ]}
          />

          {/* Search bar + Date filter toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-card border rounded-lg p-2.5 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={voucherSearch}
                onChange={(e) => setVoucherSearch(e.target.value)}
                placeholder="Search vouchers by #, client/vendor, invoice #, ticket, PNR, cheque/ref, bank, mode, amount..."
                className="pl-9 pr-8 h-9 text-xs rounded-lg bg-background"
              />
              {voucherSearch && (
                <button
                  type="button"
                  onClick={() => setVoucherSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <DateFilter
              value={voucherDateFilter}
              onChange={setVoucherDateFilter}
              className="h-9 shrink-0"
            />
          </div>

          <ExcelGrid
            id="sales_payment_vouchers"
            data={filteredVouchers}
            columns={voucherColumns}
            keyExtractor={(v) => v.id}
            title="Payment Vouchers Register"
            filename="Payment_Vouchers"
            hideColumnsButton={true}
            hideCopyButton={true}
            hideExportButton={true}
            emptyState={
              <EmptyState
                type="empty"
                actionLabel="Create Payment Voucher"
                onAction={() => setIsVoucherOpen(true)}
              />
            }
          />
        </div>
      )}

      {/* Tab 3: Refunds / Voids */}
      {currentTab === "refunds-voids" && (
        <div className="space-y-4">
          {/* Dynamic Summary Cards updated to match search & date filter */}
          <TotalsBar
            metrics={[
              {
                label: "Total Refunds Processed",
                value: filteredTotalRefunds,
                prefix: "PKR",
                highlight: "neutral",
              },
              {
                label: "Total Records",
                value: filteredRefunds.length,
                highlight: "neutral",
              },
            ]}
          />

          {/* Search bar + Date filter toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-card border rounded-lg p-2.5 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={refundSearch}
                onChange={(e) => setRefundSearch(e.target.value)}
                placeholder="Search refunds / voids by #, invoice #, ticket, PNR, party name, reason, mode, amount..."
                className="pl-9 pr-8 h-9 text-xs rounded-lg bg-background"
              />
              {refundSearch && (
                <button
                  type="button"
                  onClick={() => setRefundSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <DateFilter
              value={refundDateFilter}
              onChange={setRefundDateFilter}
              className="h-9 shrink-0"
            />
          </div>

          <ExcelGrid
            id="sales_refunds_voids"
            data={filteredRefunds}
            columns={refundColumns}
            keyExtractor={(r) => r.id}
            title="Refunds & Voids Register"
            filename="Refunds_Voids"
            hideColumnsButton={true}
            hideCopyButton={true}
            hideExportButton={true}
            emptyState={
              <EmptyState
                type="empty"
                actionLabel="Process Refund or Void"
                onAction={() => setIsRefundOpen(true)}
              />
            }
          />
        </div>
      )}

      {/* Tab 4: Expenses */}
      {currentTab === "expenses" && (
        <div className="space-y-4">
          <TotalsBar
            metrics={[
              { label: "Total Operating Expenses", value: totalExpenses, prefix: "PKR", highlight: "red" },
              { label: "Expense Entries", value: expenses.length, highlight: "neutral" },
            ]}
          />
          <ExcelGrid
            id="sales_expenses"
            data={expenses}
            columns={expenseColumns}
            keyExtractor={(e) => e.id}
            title="Operating Expenses Register"
            filename="Daily_Expenses"
            emptyState={
              <EmptyState
                type="empty"
                actionLabel="Record New Expense"
                onAction={() => setIsExpenseOpen(true)}
              />
            }
          />
        </div>
      )}

      {/* Modals */}
      <BookingInvoiceForm
        open={isInvoiceOpen}
        onOpenChange={setIsInvoiceOpen}
        onSuccess={refetchInvoices}
      />
      <PaymentVoucherForm
        open={isVoucherOpen}
        onOpenChange={setIsVoucherOpen}
        onSuccess={refetchVouchers}
      />
      <RefundVoidForm
        open={isRefundOpen}
        onOpenChange={setIsRefundOpen}
        onSuccess={refetchRefunds}
      />
      <ExpenseFormModal
        open={isExpenseOpen}
        onOpenChange={setIsExpenseOpen}
        onSuccess={refetchExpenses}
      />
    </div>
  );
}
