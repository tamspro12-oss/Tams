import type { QueryClient } from "@tanstack/react-query";
import { getInvoiceOverdueInfo } from "@/lib/overdueUtils";
import {
  KARACHI_TIMEZONE,
  getKarachiYmd,
  getKarachiTodayNoon,
} from "@/lib/karachiTime";

export { KARACHI_TIMEZONE, getKarachiYmd, getKarachiTodayNoon };

export function isInvoiceVoidedOrRefunded(inv: {
  is_void?: boolean | null;
  payment_status?: string | null;
  status?: string | null;
}): boolean {
  if (!inv) return false;
  if (inv.is_void === true) return true;
  const pStatus = (inv.payment_status || "").trim().toLowerCase();
  const sStatus = (inv.status || "").trim().toLowerCase();
  return (
    pStatus === "void" ||
    pStatus === "refunded" ||
    pStatus === "cancelled" ||
    sStatus === "void" ||
    sStatus === "refunded" ||
    sStatus === "cancelled"
  );
}

export interface FinancialSummaryResult {
  cashAndBank: number;
  clientDues: number;
  vendorDues: number;
  periodSales: number;
  periodCost: number;
  periodExpenses: number;
  periodProfit: number;
  allSales: number;
  allCost: number;
  allExpenses: number;
  allProfit: number;
  todaysBookings: number;
  overdueCount: number;
  overdueAmount: number;
}

export interface ComputeFinancialMetricsInput {
  invoices?: any[];
  vouchers?: any[];
  expenses?: any[];
  accounts?: any[];
  refunds?: any[];
  clients?: any[];
  vendors?: any[];
  periodStartYmd: string;
  periodEndYmd: string;
  todayYmd?: string;
}

/**
 * Pure canonical calculation engine mirroring get_agency_financial_summary() SQL RPC.
 * Formulas:
 * - Client Due = active invoice total - payments received (per client, never negative)
 * - Vendor Due = active vendor cost - payments made to vendor + vendor refunds received (per vendor, never negative)
 * - Profit = selling price - vendor cost - expenses (excluding voided/refunded bookings)
 * - Cash & Bank = SUM(active account balances) = opening + received - paid (transfers net to zero)
 * - Overdue = unpaid balance > 0 past effective due date (Asia/Karachi)
 */
export function computeFinancialMetrics({
  invoices = [],
  vouchers = [],
  expenses = [],
  accounts = [],
  refunds = [],
  clients = [],
  vendors = [],
  periodStartYmd,
  periodEndYmd,
  todayYmd = getKarachiYmd(),
}: ComputeFinancialMetricsInput): FinancialSummaryResult {
  const activeAccounts = (accounts || []).filter((a) => a?.active !== false);
  const hasComputedBalances = activeAccounts.some(
    (a) => a?.current_balance !== undefined && a?.current_balance !== null
  );
  let cashAndBank = activeAccounts.reduce(
    (sum, a) => sum + (Number(a?.current_balance ?? a?.opening_balance) || 0),
    0
  );

  // When accounts come directly from the accounts table without account_balances() RPC,
  // compute opening + received - paid - expenses + vendor refunds - client refunds (transfers net to 0).
  if (!hasComputedBalances) {
    const activeVouchersNet = (vouchers || [])
      .filter((v) => !v?.is_void && !v?.is_adjustment)
      .reduce((sum, v) => {
        const amt = Number(v?.amount) || 0;
        const dir = (v?.direction || "").toLowerCase();
        if (dir === "received") return sum + amt;
        if (dir === "paid") return sum - amt;
        return sum;
      }, 0);
    const totalExpensesCash = (expenses || []).reduce(
      (sum, e) => sum + (Number(e?.amount) || 0),
      0
    );
    const refundsNet = (refunds || []).reduce((sum, r) => {
      const clientOut = Number(r?.client_refund_amount ?? r?.refund_amount ?? r?.amount) || 0;
      const vendorIn = Number(r?.vendor_refund_amount) || 0;
      return sum + vendorIn - clientOut;
    }, 0);
    cashAndBank += activeVouchersNet - totalExpensesCash + refundsNet;
  }

  const hasBookingInvoices = (invoices || []).length > 0;
  let clientDues = 0;
  let vendorDues = 0;
  let periodSales = 0;
  let periodCost = 0;
  let allSales = 0;
  let allCost = 0;
  let todaysBookings = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  if (hasBookingInvoices) {
    const activeInvoices = invoices.filter((inv) => !isInvoiceVoidedOrRefunded(inv));

    // Client Dues grouped per client key (never negative per client)
    const clientDueMap = new Map<string, number>();
    // Vendor Costs grouped per vendor key
    const vendorCostMap = new Map<string, number>();

    activeInvoices.forEach((inv) => {
      const clientKey = String(inv.party_id || inv.id);
      const clientAmt = Number(inv.client_amount ?? inv.selling_price ?? 0) || 0;
      const paidAmt = Number(inv.paid_amount ?? inv.amount_paid ?? 0) || 0;
      const invDue = Math.max(0, clientAmt - paidAmt);
      clientDueMap.set(clientKey, (clientDueMap.get(clientKey) || 0) + invDue);

      const vendorPayable = Number(inv.vendor_payable ?? inv.purchasing_price ?? 0) || 0;
      if (vendorPayable > 0) {
        const vendorKey = String(inv.vendor_id || `direct_${inv.id}`);
        vendorCostMap.set(vendorKey, (vendorCostMap.get(vendorKey) || 0) + vendorPayable);
      }

      const invYmd = getKarachiYmd(inv.invoice_date || inv.created_at || "");
      const createdYmd = getKarachiYmd(inv.created_at || inv.invoice_date || "");

      allSales += clientAmt;
      allCost += vendorPayable;

      if (invYmd && invYmd >= periodStartYmd && invYmd <= periodEndYmd) {
        periodSales += clientAmt;
        periodCost += vendorPayable;
      }

      if (createdYmd === todayYmd || invYmd === todayYmd) {
        todaysBookings += 1;
      }

      const overdue = getInvoiceOverdueInfo(inv, getKarachiTodayNoon());
      if (overdue.isOverdue && invDue > 0) {
        overdueCount += 1;
        overdueAmount += invDue;
      }
    });

    clientDueMap.forEach((val) => {
      clientDues += Math.max(0, val);
    });

    // Aggregate non-void vendor payments from vouchers & vendor refunds on non-void bookings
    const vendorPaidMap = new Map<string, number>();
    (vouchers || []).forEach((v) => {
      if (v?.is_void) return;
      if (v?.direction === "paid" && v?.party_id) {
        const key = String(v.party_id);
        vendorPaidMap.set(key, (vendorPaidMap.get(key) || 0) + (Number(v.amount) || 0));
      }
    });

    const activeInvVendorById = new Map<string, string>();
    activeInvoices.forEach((inv) => {
      if (inv?.id && inv?.vendor_id) {
        activeInvVendorById.set(String(inv.id), String(inv.vendor_id));
      }
    });

    const vendorRefundMap = new Map<string, number>();
    (refunds || []).forEach((r) => {
      const bookingId = r?.booking_id ? String(r.booking_id) : "";
      const vId = activeInvVendorById.get(bookingId);
      if (vId) {
        vendorRefundMap.set(vId, (vendorRefundMap.get(vId) || 0) + (Number(r.vendor_refund_amount) || 0));
      }
    });

    vendorCostMap.forEach((cost, vendorKey) => {
      const paid = vendorPaidMap.get(vendorKey) || 0;
      const refunded = vendorRefundMap.get(vendorKey) || 0;
      const netVendorDue = Math.max(0, cost - (paid - refunded));
      vendorDues += netVendorDue;
    });
  } else {
    // Legacy fallback ONLY when booking_invoices has zero rows
    (clients || []).forEach((c) => {
      if (isInvoiceVoidedOrRefunded(c)) return;
      const sell = Number(c.selling_price) || 0;
      const buy = Number(c.purchasing_price) || 0;
      const paid = Number(c.amount_paid) || 0;
      const due = Math.max(0, sell - paid);
      clientDues += due;

      const invYmd = getKarachiYmd(c.flight_date || c.created_at || "");
      const createdYmd = getKarachiYmd(c.created_at || c.flight_date || "");

      allSales += sell;
      allCost += buy;
      if (invYmd && invYmd >= periodStartYmd && invYmd <= periodEndYmd) {
        periodSales += sell;
        periodCost += buy;
      }
      if (createdYmd === todayYmd) {
        todaysBookings += 1;
      }

      const overdue = getInvoiceOverdueInfo(c, getKarachiTodayNoon());
      if (overdue.isOverdue && due > 0) {
        overdueCount += 1;
        overdueAmount += due;
      }
    });

    (vendors || []).forEach((v) => {
      const payable = Number(v.payment_amount) || 0;
      const paid = Number(v.amount_paid) || 0;
      vendorDues += Math.max(0, payable - paid);
    });
  }

  let periodExpenses = 0;
  let allExpenses = 0;
  (expenses || []).forEach((e) => {
    const amt = Number(e?.amount) || 0;
    allExpenses += amt;
    const expYmd = getKarachiYmd(e?.expense_date || e?.created_at || "");
    if (expYmd && expYmd >= periodStartYmd && expYmd <= periodEndYmd) {
      periodExpenses += amt;
    }
  });

  const periodProfit = periodSales - periodCost - periodExpenses;
  const allProfit = allSales - allCost - allExpenses;

  return {
    cashAndBank,
    clientDues,
    vendorDues,
    periodSales,
    periodCost,
    periodExpenses,
    periodProfit,
    allSales,
    allCost,
    allExpenses,
    allProfit,
    todaysBookings,
    overdueCount,
    overdueAmount,
  };
}

/**
 * Resolves the exact accounts.id UUID for Cash or a selected Bank name,
 * avoiding NULL account_id inserts that break Cash & Bank totals.
 */
export function resolveAccountIdForPayment(
  accounts: Array<{ id: string; type: string; name: string; active?: boolean }> = [],
  paymentMode: string = "cash",
  selectedBankName?: string | null
): string | null {
  const activeAccounts = accounts.filter((a) => a.active !== false);
  const mode = (paymentMode || "cash").toLowerCase();

  if (mode === "bank" || mode === "transfer" || mode === "cheque" || mode === "online") {
    const targetName = (selectedBankName || "").trim().toLowerCase();
    if (targetName) {
      const exact = activeAccounts.find(
        (a) => a.type === "bank" && a.name.trim().toLowerCase() === targetName
      );
      if (exact) return exact.id;

      const partial = activeAccounts.find(
        (a) =>
          a.type === "bank" &&
          (a.name.trim().toLowerCase().includes(targetName) ||
            targetName.includes(a.name.trim().toLowerCase()))
      );
      if (partial) return partial.id;
    }

    const firstBank = activeAccounts.find((a) => a.type === "bank");
    if (firstBank) return firstBank.id;
  }

  const cashAccount = activeAccounts.find((a) => a.type === "cash");
  return cashAccount?.id || activeAccounts[0]?.id || null;
}

const FINANCIAL_QUERY_PREFIXES = [
  "booking_invoices",
  "dashboard_invoices",
  "agency_financial_summary",
  "agency_overdue_invoices",
  "reconcile_agency_balances",
  "sales_expenses_invoices",
  "parties",
  "clients",
  "vendors",
  "clients-paginated",
  "payment_vouchers",
  "recent_payment_vouchers",
  "expenses",
  "sales_expenses",
  "refunds",
  "sales_refunds",
  "recent_sales_refunds",
  "transactions",
  "accounts",
  "accounts_with_balances",
  "agency_banks",
  "agency_ledger",
  "party_statement",
  "party_balances",
  "clientPaymentHistory",
  "vendorPaymentHistory",
  "all-client-payment-history",
  "cash_bank_entries",
  "report_invoices",
  "report_transactions",
  "report_expenses",
  "report_refunds",
  "alert_booking_invoices",
  "alert_clients",
  "alert_expenses",
  "alert_refunds",
  "unified_portal_alerts",
  "agency_notifications",
  "dashboard",
  "reports",
] as const;

export async function invalidateAllFinancialQueries(
  queryClient: QueryClient,
  _agencyId?: string | null
): Promise<void> {
  await Promise.all(
    FINANCIAL_QUERY_PREFIXES.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
  );
}
