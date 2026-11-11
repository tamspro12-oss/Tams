import { format } from "date-fns";

export interface InvoiceOverdueTarget {
  payment_status?: string | null;
  client_amount?: number | null;
  paid_amount?: number | null;
  selling_price?: number | null;
  amount_paid?: number | null;
  invoice_date?: string | null;
  created_at?: string | null;
  remaining_payment_date?: string | null;
  more_details?: {
    remaining_due_date?: string | null;
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
 * Rule: Due date = Remaining Due Date; if empty, use the invoice date (or creation date).
 * An invoice is only overdue if balance remains (> 0) and due date < today.
 */
export function getInvoiceOverdueInfo(
  inv: InvoiceOverdueTarget,
  asOfDate: Date = new Date()
): OverdueCalculationResult {
  const totalAmount = Number(inv.client_amount ?? inv.selling_price ?? 0);
  const totalPaid = Number(inv.paid_amount ?? inv.amount_paid ?? 0);
  const status = (inv.payment_status || "").toLowerCase();

  const isFullyPaid = status === "paid" || (totalAmount > 0 && totalPaid >= totalAmount);

  const todayStr = format(asOfDate, "yyyy-MM-dd");
  const dueDate =
    inv.more_details?.remaining_due_date ||
    inv.remaining_payment_date ||
    inv.invoice_date ||
    (inv.created_at ? inv.created_at.slice(0, 10) : todayStr);

  if (isFullyPaid) {
    return {
      isOverdue: false,
      overdueDays: 0,
      dueDate,
    };
  }

  if (dueDate < todayStr) {
    const diffTime = asOfDate.getTime() - new Date(dueDate).getTime();
    const days = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    return {
      isOverdue: true,
      overdueDays: days,
      dueDate,
    };
  }

  return {
    isOverdue: false,
    overdueDays: 0,
    dueDate,
  };
}

