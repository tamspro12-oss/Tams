import { getKarachiTodayNoon, getKarachiYmd } from "@/lib/karachiTime";

export interface InvoiceOverdueTarget {
  is_void?: boolean | null;
  payment_status?: string | null;
  status?: string | null;
  client_amount?: number | null;
  paid_amount?: number | null;
  selling_price?: number | null;
  amount_paid?: number | null;
  invoice_date?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  flight_date?: string | null;
  remaining_payment_date?: string | null;
  more_details?: {
    remaining_due_date?: string | null;
    due_date?: string | null;
    [key: string]: any;
  } | null;
}

export interface OverdueCalculationResult {
  isOverdue: boolean;
  overdueDays: number;
  dueDate: string;
}

/**
 * Standard shared overdue logic for Dashboard, Reports, and Notifications.
 * Rule:
 *  - Exclude voided, cancelled, or refunded bookings.
 *  - Due date = due_date ?? remaining_due_date ?? remaining_payment_date ?? invoice_date ?? created_at (Asia/Karachi).
 *  - Overdue iff unpaid balance > 0 AND due date < Asia/Karachi today.
 */
export function getInvoiceOverdueInfo(
  inv: InvoiceOverdueTarget,
  asOfDate: Date = getKarachiTodayNoon()
): OverdueCalculationResult {
  const totalAmount = Number(inv.client_amount ?? inv.selling_price ?? 0) || 0;
  const totalPaid = Number(inv.paid_amount ?? inv.amount_paid ?? 0) || 0;
  const status = (inv.payment_status || inv.status || "").trim().toLowerCase();

  const isVoidedOrRefunded =
    inv.is_void === true ||
    status === "void" ||
    status === "refunded" ||
    status === "cancelled";

  const remaining = Math.max(0, totalAmount - totalPaid);
  const isFullyPaid = status === "paid" || remaining <= 0;

  const todayStr = getKarachiYmd(asOfDate);
  const rawDueDate =
    inv.due_date ||
    inv.more_details?.remaining_due_date ||
    inv.more_details?.due_date ||
    inv.remaining_payment_date ||
    inv.invoice_date ||
    inv.flight_date ||
    (inv.created_at ? getKarachiYmd(inv.created_at) : todayStr);

  const dueDate = getKarachiYmd(rawDueDate) || todayStr;

  if (isVoidedOrRefunded || isFullyPaid) {
    return {
      isOverdue: false,
      overdueDays: 0,
      dueDate,
    };
  }

  if (dueDate < todayStr) {
    const dueNoon = new Date(`${dueDate}T12:00:00Z`).getTime();
    const todayNoon = new Date(`${todayStr}T12:00:00Z`).getTime();
    const diffDays = Math.round((todayNoon - dueNoon) / (1000 * 60 * 60 * 24));
    return {
      isOverdue: true,
      overdueDays: Math.max(1, diffDays),
      dueDate,
    };
  }

  return {
    isOverdue: false,
    overdueDays: 0,
    dueDate,
  };
}
