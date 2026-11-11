import React, { useState, useMemo, useEffect } from "react";
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
import { CopyValue } from "@/components/ui/CopyValue";
import { matchesMultipleFields, cleanPastedSearch } from "@/lib/searchUtils";
import { cn } from "@/lib/utils";
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

  // Filters state for Booking Invoices (Default This Month)
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceDateFilter, setInvoiceDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  // Filters state for Payment Vouchers (Default This Month)
  const [voucherSearch, setVoucherSearch] = useState("");
  const [voucherDateFilter, setVoucherDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  // Filters state for Refunds / Voids (Default This Month)
  const [refundSearch, setRefundSearch] = useState("");
  const [refundDateFilter, setRefundDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  // Filters state for Expenses (Default This Month)
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseDateFilter, setExpenseDateFilter] = useState<DatePresetFilterValue>({
    preset: "this_month",
  });

  const handleTabChange = (val: string) => {
    setSearchParams({ tab: val }, { replace: true });
  };

  // Sync URL search parameters for ?new=1 and ?date=today
  useEffect(() => {
    const isNew = searchParams.get("new") === "1" || searchParams.get("action") === "new";
    if (isNew) {
      if (currentTab === "booking-invoice") setIsInvoiceOpen(true);
      else if (currentTab === "payment-vouchers") setIsVoucherOpen(true);
      else if (currentTab === "refunds-voids") setIsRefundOpen(true);
      else if (currentTab === "expenses") setIsExpenseOpen(true);
    }

    if (searchParams.get("date") === "today") {
      setInvoiceDateFilter({ preset: "today" });
    }
  }, [searchParams, currentTab]);

  const handleModalClose = (setter: React.Dispatch<React.SetStateAction<boolean>>) => (open: boolean) => {
    setter(open);
    if (!open && (searchParams.get("new") || searchParams.get("action"))) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("new");
      nextParams.delete("action");
      setSearchParams(nextParams, { replace: true });
    }
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
    if (client?.pnr) return client.pnr;
    if (client?.passport_number) return client.passport_number;
    const matchInv = r.notes?.match(/Ref Invoice:\s*([^|]+)/);
    if (matchInv) return matchInv[1].trim();
    if (r.invoice_no) return r.invoice_no;
    return "—";
  };

  // -------------------------------------------------------------
  // Filtered Booking Invoices (by Search & Date)
  // -------------------------------------------------------------
  const filteredInvoices = useMemo(() => {
    return invoices
      .map((inv: any) => {
        const clientAmount = Number(inv.client_amount) || 0;
        const paidAmount = Number(inv.paid_amount) || 0;
        const remainingAmount = Math.max(0, clientAmount - paidAmount);
        const computedStatus =
          remainingAmount === 0 ? "paid" : paidAmount > 0 ? "partial" : "pending";

        return {
          ...inv,
          client_amount: clientAmount,
          paid_amount: paidAmount,
          remaining_amount: remainingAmount,
          payment_status: computedStatus,
        };
      })
      .filter((inv: any) => {
        // 1. Date Filter (defaults to This Month)
        if (
          !isDateWithinPreset(
            inv.invoice_date,
            invoiceDateFilter.preset,
            invoiceDateFilter.customFrom,
            invoiceDateFilter.customTo
          )
        ) {
          return false;
        }

        // 2. Search query live-filter: invoice number, client name, PNR, ticket number, service, status
        if (invoiceSearch.trim()) {
          const clientName = inv.party?.name || inv.client_name || "";
          const matches = matchesMultipleFields(
            [
              inv.invoice_no,
              clientName,
              inv.pnr,
              inv.ticket_no,
              inv.service,
              inv.payment_status,
            ],
            invoiceSearch
          );
          if (!matches) return false;
        }

        return true;
      });
  }, [invoices, invoiceSearch, invoiceDateFilter]);

  // Dynamic summary cards for Booking Invoices (match search & date filter)
  const filteredTotalInvoiced = useMemo(
    () => filteredInvoices.reduce((sum: number, inv: any) => sum + (inv.client_amount || 0), 0),
    [filteredInvoices]
  );
  const filteredNetProfit = useMemo(
    () => filteredInvoices.reduce((sum: number, inv: any) => sum + (inv.profit || 0), 0),
    [filteredInvoices]
  );

  // -------------------------------------------------------------
  // Filtered Vouchers (by Search & Date)
  // -------------------------------------------------------------
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
        const matches = matchesMultipleFields(
          [
            v.voucher_no,
            v.party?.name,
            v.reference_no,
            v.notes,
            v.payment_mode,
            v.amount,
            v.ticket_no,
            v.pnr,
          ],
          voucherSearch
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [vouchers, voucherSearch, voucherDateFilter]);

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

  // -------------------------------------------------------------
  // Filtered Refunds (by Search & Date)
  // -------------------------------------------------------------
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
        const refundNo = r.refund_no || r.reference_no || `REF-${r.id.slice(0, 6)}`;
        const party = getRefundPartyName(r);
        const refInfo = getRefundRefInfo(r);
        const matches = matchesMultipleFields(
          [
            refundNo,
            party,
            refInfo,
            r.reason,
            r.payment_mode,
            r.notes,
            r.refund_amount,
          ],
          refundSearch
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [refunds, refundSearch, refundDateFilter, clientsLookup]);

  const filteredTotalRefunds = useMemo(
    () =>
      filteredRefunds.reduce(
        (sum: number, r: any) => sum + (r.refund_amount || 0),
        0
      ),
    [filteredRefunds]
  );

  // -------------------------------------------------------------
  // Filtered Expenses (by Search & Date)
  // -------------------------------------------------------------
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e: any) => {
      // 1. Date Filter (defaults to This Month)
      if (
        !isDateWithinPreset(
          e.expense_date,
          expenseDateFilter.preset,
          expenseDateFilter.customFrom,
          expenseDateFilter.customTo
        )
      ) {
        return false;
      }

      // 2. Search query live-filter: category, particulars, ref no, paid from, amount
      if (expenseSearch.trim()) {
        const category = e.expense_type || e.category || "";
        const particulars = e.notes || "";
        const refNo = e.reference_number || e.reference_no || "";
        const paidFrom = e.payment_mode === "bank" ? "Bank Account" : "Cash in Hand";
        const amt = String(e.amount || "");
        const expNo =
          e.reference_number ||
          e.reference_no ||
          (e.id ? `EXP-${e.id.slice(0, 6)}` : "");

        const matches = matchesMultipleFields(
          [category, particulars, refNo, paidFrom, amt, expNo, e.bank_name],
          expenseSearch
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [expenses, expenseSearch, expenseDateFilter]);

  const filteredTotalExpenses = useMemo(
    () => filteredExpenses.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0),
    [filteredExpenses]
  );

  // -------------------------------------------------------------
  // Table Columns
  // -------------------------------------------------------------

  // 1. Booking Invoices:
  // Invoice # | Date | Service | Client | Total Amount | Paid Amount | Remaining Amount | Status | PDF
  const invoiceColumns: GridColumn[] = [
    {
      key: "invoice_no",
      header: "Invoice #",
      width: 120,
      render: (inv) => (
        <CopyValue
          value={inv.invoice_no}
          label="invoice number"
          className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200"
        />
      ),
    },
    {
      key: "invoice_date",
      header: "Date",
      width: 95,
      render: (inv) => <span className="text-xs font-mono">{inv.invoice_date}</span>,
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
      minWidth: 160,
      render: (inv) => {
        const cName = inv.party?.name || inv.client_name || "—";
        return (
          <div className="space-y-0.5">
            <CopyValue value={cName} label="client name" className="font-semibold block" />
            {inv.pnr && (
              <div className="text-[10px] text-muted-foreground font-mono">
                PNR: <CopyValue value={inv.pnr} label="PNR" />
              </div>
            )}
            {inv.ticket_no && (
              <div className="text-[10px] text-muted-foreground font-mono">
                Tkt: <CopyValue value={inv.ticket_no} label="ticket number" />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "client_amount",
      header: "Total Amount (PKR)",
      width: 135,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (inv) => (
        <CopyValue
          value={inv.client_amount || 0}
          isAmount={true}
          displayValue={
            <span className="font-mono font-bold">
              {(inv.client_amount || 0).toLocaleString()}
            </span>
          }
          label="total amount"
        />
      ),
    },
    {
      key: "paid_amount",
      header: "Paid Amount (PKR)",
      width: 130,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (inv) => (
        <CopyValue
          value={inv.paid_amount || 0}
          isAmount={true}
          displayValue={
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              {(inv.paid_amount || 0).toLocaleString()}
            </span>
          }
          label="paid amount"
        />
      ),
    },
    {
      key: "remaining_amount",
      header: "Remaining Amount (PKR)",
      width: 145,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (inv) => {
        const rem = inv.remaining_amount || 0;
        return (
          <CopyValue
            value={rem}
            isAmount={true}
            displayValue={
              <span
                className={cn(
                  "font-mono font-bold",
                  rem > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {rem.toLocaleString()}
              </span>
            }
            label="remaining amount"
          />
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
      width: 85,
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
                balanceDue: inv.remaining_amount || 0,
              });
            }}
            title="Download Confirmation"
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-teal-600 cursor-pointer"
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
                balanceDue: inv.remaining_amount || 0,
              });
            }}
            title="Download Invoice"
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-blue-600 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  // 2. Payment Vouchers:
  const voucherColumns: GridColumn[] = [
    {
      key: "voucher_no",
      header: "Voucher #",
      width: 125,
      render: (v) => (
        <CopyValue
          value={v.voucher_no}
          label="voucher number"
          className="font-mono font-bold text-xs"
        />
      ),
    },
    {
      key: "voucher_date",
      header: "Date",
      width: 95,
      render: (v) => <span className="text-xs font-mono">{v.voucher_date}</span>,
    },
    {
      key: "direction",
      header: "Type",
      width: 95,
      render: (v) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            v.direction === "received"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300"
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
          <CopyValue
            value={v.party?.name || "Direct Account"}
            label="party name"
            className="font-semibold block"
          />
          {v.notes && <span className="text-[10px] text-muted-foreground block">{v.notes}</span>}
          {v.reference_no && (
            <span className="text-[10px] text-muted-foreground font-mono block">
              Ref: <CopyValue value={v.reference_no} label="reference" />
            </span>
          )}
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
        <CopyValue
          value={v.amount || 0}
          isAmount={true}
          displayValue={
            <span
              className={`font-mono font-bold ${
                v.direction === "received" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {(v.amount || 0).toLocaleString()}
            </span>
          }
          label="amount"
        />
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
          className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  // 3. Refunds / Voids:
  const refundColumns: GridColumn[] = [
    {
      key: "refund_date",
      header: "Date",
      width: 95,
      render: (r) => <span className="text-xs font-mono">{r.refund_date}</span>,
    },
    {
      key: "refund_no",
      header: "Refund #",
      width: 125,
      render: (r) => {
        const rNo = r.refund_no || r.reference_no || `REF-${r.id.slice(0, 6).toUpperCase()}`;
        return (
          <CopyValue
            value={rNo}
            label="refund number"
            className="font-mono font-bold text-xs"
          />
        );
      },
    },
    {
      key: "ref_info",
      header: "Invoice / Ticket / PNR",
      minWidth: 140,
      render: (r) => {
        const info = getRefundRefInfo(r);
        return info !== "—" ? (
          <CopyValue value={info} label="reference" className="text-xs font-mono" />
        ) : (
          <span className="text-xs font-mono text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "party_name",
      header: "Party Name",
      minWidth: 150,
      render: (r) => (
        <CopyValue
          value={getRefundPartyName(r)}
          label="party name"
          className="text-xs font-semibold"
        />
      ),
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
        <CopyValue
          value={r.refund_amount || 0}
          isAmount={true}
          displayValue={
            <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
              {(r.refund_amount || 0).toLocaleString()}
            </span>
          }
          label="amount"
        />
      ),
    },
  ];

  // 4. Expenses:
  // Date | Expense No | Category | Type (Normal/Recurring) | Paid From | Ref / Receipt # | Particulars | Amount (PKR)
  const expenseColumns: GridColumn[] = [
    {
      key: "expense_date",
      header: "Date",
      width: 95,
      render: (e) => <span className="text-xs font-mono">{e.expense_date}</span>,
    },
    {
      key: "expense_no",
      header: "Expense #",
      width: 120,
      render: (e) => {
        const expNo =
          e.reference_number ||
          e.reference_no ||
          (e.id ? `EXP-${e.id.slice(0, 6).toUpperCase()}` : "EXP-1001");
        return (
          <CopyValue
            value={expNo}
            label="expense number"
            className="font-mono font-bold text-xs"
          />
        );
      },
    },
    {
      key: "expense_type",
      header: "Category",
      minWidth: 140,
      render: (e) => (
        <CopyValue
          value={e.expense_type || e.category || "General"}
          label="category"
          className="font-semibold text-xs text-slate-800 dark:text-slate-200"
        />
      ),
    },
    {
      key: "is_recurring",
      header: "Type",
      width: 110,
      render: (e) => {
        const isRec = Boolean(e.is_recurring && !e.recurring_parent_id);
        return isRec ? (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200">
            Recurring ({e.recurring_frequency || "Monthly"})
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border">
            Normal
          </span>
        );
      },
    },
    {
      key: "payment_mode",
      header: "Paid From",
      width: 120,
      render: (e) => (
        <span className="text-xs text-slate-600 dark:text-slate-400 capitalize">
          {e.payment_mode === "bank"
            ? e.bank_name
              ? `Bank (${e.bank_name})`
              : "Bank Account"
            : "Cash in Hand"}
        </span>
      ),
    },
    {
      key: "reference_no",
      header: "Ref / Receipt #",
      width: 120,
      render: (e) => {
        const ref = e.reference_number || e.reference_no;
        return ref ? (
          <CopyValue value={ref} label="reference" className="text-xs font-mono text-slate-500" />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      key: "notes",
      header: "Particulars",
      minWidth: 180,
      render: (e) => (
        <span className="text-xs text-muted-foreground select-text">{e.notes || "—"}</span>
      ),
    },
    {
      key: "amount",
      header: "Amount (PKR)",
      width: 130,
      isNumeric: true,
      align: "right",
      totalType: "sum",
      render: (e) => (
        <CopyValue
          value={e.amount || 0}
          isAmount={true}
          displayValue={
            <span className="font-mono font-bold text-red-600 dark:text-red-400">
              {(e.amount || 0).toLocaleString()}
            </span>
          }
          label="amount"
        />
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

      {/* Header with Action Buttons */}
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
                Record Daily Expense
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
              {
                label: "Total Invoiced",
                value: filteredTotalInvoiced,
                prefix: "PKR",
                highlight: "neutral",
              },
              {
                label: "Net Profit",
                value: filteredNetProfit,
                prefix: "PKR",
                highlight: "teal",
              },
              {
                label: "Total Bookings",
                value: filteredInvoices.length,
                highlight: "neutral",
              },
            ]}
          />

          {/* Search bar + Date filter toolbar (Booking Invoices) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-card border rounded-lg p-2.5 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted) {
                    e.preventDefault();
                    setInvoiceSearch(cleanPastedSearch(pasted));
                  }
                }}
                placeholder="Search invoices by invoice #, client name, PNR, ticket #, service, status..."
                className="pl-9 pr-8 h-9 text-xs rounded-lg bg-background"
              />
              {invoiceSearch && (
                <button
                  type="button"
                  onClick={() => setInvoiceSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <DateFilter
              value={invoiceDateFilter}
              onChange={setInvoiceDateFilter}
              className="h-9 shrink-0"
            />
          </div>

          <ExcelGrid
            id="sales_booking_invoices"
            data={filteredInvoices}
            columns={invoiceColumns}
            keyExtractor={(inv) => inv.id}
            title="Booking Invoices Register"
            filename="Booking_Invoices"
            hideColumnsButton={true}
            hideCopyButton={true}
            hideExportButton={true}
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
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted) {
                    e.preventDefault();
                    setVoucherSearch(cleanPastedSearch(pasted));
                  }
                }}
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
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted) {
                    e.preventDefault();
                    setRefundSearch(cleanPastedSearch(pasted));
                  }
                }}
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
              {
                label: "Total Operating Expenses",
                value: filteredTotalExpenses,
                prefix: "PKR",
                highlight: "red",
              },
              {
                label: "Expense Entries",
                value: filteredExpenses.length,
                highlight: "neutral",
              },
            ]}
          />

          {/* Search bar + Date filter toolbar (Expenses) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 bg-card border rounded-lg p-2.5 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted) {
                    e.preventDefault();
                    setExpenseSearch(cleanPastedSearch(pasted));
                  }
                }}
                placeholder="Search expenses by category, particulars, ref #, paid from, amount..."
                className="pl-9 pr-8 h-9 text-xs rounded-lg bg-background"
              />
              {expenseSearch && (
                <button
                  type="button"
                  onClick={() => setExpenseSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <DateFilter
              value={expenseDateFilter}
              onChange={setExpenseDateFilter}
              className="h-9 shrink-0"
            />
          </div>

          <ExcelGrid
            id="sales_expenses"
            data={filteredExpenses}
            columns={expenseColumns}
            keyExtractor={(e) => e.id}
            title="Operating Expenses Register"
            filename="Daily_Expenses"
            hideColumnsButton={true}
            hideCopyButton={true}
            hideExportButton={true}
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
        onOpenChange={handleModalClose(setIsInvoiceOpen)}
        onSuccess={refetchInvoices}
      />
      <PaymentVoucherForm
        open={isVoucherOpen}
        onOpenChange={handleModalClose(setIsVoucherOpen)}
        onSuccess={refetchVouchers}
      />
      <RefundVoidForm
        open={isRefundOpen}
        onOpenChange={handleModalClose(setIsRefundOpen)}
        onSuccess={refetchRefunds}
      />
      <ExpenseFormModal
        open={isExpenseOpen}
        onOpenChange={handleModalClose(setIsExpenseOpen)}
        onSuccess={refetchExpenses}
      />
    </div>
  );
}
