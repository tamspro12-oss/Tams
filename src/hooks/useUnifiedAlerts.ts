import { useMemo, useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { useParties, type Party } from "@/hooks/useParties";
import { useAccounts } from "@/hooks/useUnifiedTransactions";
import { format, isToday, isTomorrow, addDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { getInvoiceOverdueInfo } from "@/lib/overdueUtils";
import {
  getKarachiTodayNoon,
  getKarachiYmd,
  isInvoiceVoidedOrRefunded,
} from "@/lib/accountingEngine";

export interface PortalAlertItem {
  id: string;
  agency_id?: string;
  title: string;
  description: string;
  type: "travel" | "accounts" | "reminders" | "system";
  priority: "overdue" | "due_today" | "upcoming" | "info";
  dueDate?: string;
  sourceId?: string;
  sourceType?: "invoice" | "party" | "booking" | "query" | "quote" | "expense" | "refund" | "reminder";
  clientName?: string;
  vendorName?: string;
  invoiceNo?: string;
  pnr?: string;
  ticketNo?: string;
  passportNo?: string;
  amount?: number;
  isRead: boolean;
  isDone: boolean;
  snoozedUntil?: string | null;
  createdAt: string;
  mainAction: {
    label: string;
    url?: string;
    modalType?: "payment_voucher" | "booking_invoice" | "expense" | "refund" | "query" | "quotation";
    modalProps?: Record<string, any>;
  };
  secondaryAction?: {
    label: string;
    url?: string;
  };
}

export interface AlertPreferences {
  pendingClientPayment: boolean;
  invoiceOverdue: boolean;
  paymentDueSoon: boolean;
  vendorPayableDue: boolean;
  upcomingDeparture: boolean;
  returnDateApproaching: boolean;
  pendingRefund: boolean;
  recurringExpenseDue: boolean;
  queryQuoteFollowUp: boolean;
  endOfDayReminder: boolean;
  lowBalanceAlert: boolean;
  daysBeforeDeparture: number;
  daysBeforeDueDate: number;
  endOfDayTime: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  lowBalanceThreshold: number;
  soundEnabled: boolean;
  pushEnabled: boolean;
}

export const DEFAULT_PREFERENCES: AlertPreferences = {
  pendingClientPayment: true,
  invoiceOverdue: true,
  paymentDueSoon: true,
  vendorPayableDue: true,
  upcomingDeparture: true,
  returnDateApproaching: true,
  pendingRefund: true,
  recurringExpenseDue: true,
  queryQuoteFollowUp: true,
  endOfDayReminder: true,
  lowBalanceAlert: true,
  daysBeforeDeparture: 7,
  daysBeforeDueDate: 3,
  endOfDayTime: "19:00",
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  lowBalanceThreshold: 0,
  soundEnabled: true,
  pushEnabled: false,
};

const STORAGE_PREFS_KEY = "tams_alert_preferences_v2";
const STORAGE_DONE_KEY = "tams_alert_done_ids";
const STORAGE_READ_KEY = "tams_alert_read_ids";
const STORAGE_SNOOZE_KEY = "tams_alert_snooze_map";

const scopedAlertKey = (base: string, agencyId?: string | null) =>
  agencyId ? `${base}_${agencyId}` : base;

export function useUnifiedAlerts() {
  const queryClient = useQueryClient();
  const { data: agencyId } = useCurrentAgencyId();
  const { parties = [] } = useParties();
  const { accounts = [], cashAccount } = useAccounts();

  // 1. UI Preferences State (strictly scoped by agencyId)
  const [preferences, setPreferences] = useState<AlertPreferences>(DEFAULT_PREFERENCES);
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [snoozeMap, setSnoozeMap] = useState<Record<string, string>>(() => ({}));

  useEffect(() => {
    if (!agencyId) {
      setPreferences(DEFAULT_PREFERENCES);
      setDoneIds(new Set());
      setReadIds(new Set());
      setSnoozeMap({});
      return;
    }
    try {
      const savedPrefs = localStorage.getItem(scopedAlertKey(STORAGE_PREFS_KEY, agencyId));
      setPreferences(savedPrefs ? { ...DEFAULT_PREFERENCES, ...JSON.parse(savedPrefs) } : DEFAULT_PREFERENCES);
    } catch {
      setPreferences(DEFAULT_PREFERENCES);
    }
    try {
      const savedDone = localStorage.getItem(scopedAlertKey(STORAGE_DONE_KEY, agencyId));
      setDoneIds(savedDone ? new Set(JSON.parse(savedDone)) : new Set());
    } catch {
      setDoneIds(new Set());
    }
    try {
      const savedRead = localStorage.getItem(scopedAlertKey(STORAGE_READ_KEY, agencyId));
      setReadIds(savedRead ? new Set(JSON.parse(savedRead)) : new Set());
    } catch {
      setReadIds(new Set());
    }
    try {
      const savedSnooze = localStorage.getItem(scopedAlertKey(STORAGE_SNOOZE_KEY, agencyId));
      setSnoozeMap(savedSnooze ? JSON.parse(savedSnooze) : {});
    } catch {
      setSnoozeMap({});
    }
  }, [agencyId]);

  const savePreferences = useCallback((newPrefs: Partial<AlertPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      if (agencyId) {
        try {
          localStorage.setItem(scopedAlertKey(STORAGE_PREFS_KEY, agencyId), JSON.stringify(updated));
        } catch (e) {
          console.warn("Could not save preferences to localStorage:", e);
        }
      }
      return updated;
    });
    toast.success("Preferences saved successfully");
  }, [agencyId]);

  // 3. Query Invoices
  const { data: bookingInvoices = [] } = useQuery({
    queryKey: ["alert_booking_invoices", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await (supabase as any)
        .from("booking_invoices")
        .select("*, party:parties!party_id(name, phone), vendor:parties!vendor_id(name)")
        .eq("agency_id", agencyId)
        .order("invoice_date", { ascending: false });
      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // Fallback / legacy clients
  const { data: clientsData = [] } = useQuery({
    queryKey: ["alert_clients", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // 4. Query Expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ["alert_expenses", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await supabase
        .from("expenses")
        .select("*")
        .eq("agency_id", agencyId)
        .order("expense_date", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // 5. Query Refunds
  const { data: refunds = [] } = useQuery({
    queryKey: ["alert_refunds", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await supabase
        .from("refunds")
        .select("*")
        .eq("agency_id", agencyId)
        .order("refund_date", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // 6. Query Queries
  const { data: queries = [] } = useQuery({
    queryKey: ["alert_queries", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await supabase
        .from("queries")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // 7. Query Quotations
  const { data: quotations = [] } = useQuery({
    queryKey: ["alert_quotations", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await supabase
        .from("quotations")
        .select("*")
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 60 * 1000,
  });

  // 8. Query Reminders table
  const { data: customReminders = [] } = useQuery({
    queryKey: ["alert_custom_reminders", agencyId],
    queryFn: async () => {
      if (!agencyId) return [];
      const { data } = await supabase
        .from("reminders" as any)
        .select("*")
        .eq("agency_id", agencyId)
        .eq("is_completed", false)
        .order("remind_date", { ascending: true });
      return data || [];
    },
    enabled: !!agencyId,
    staleTime: 30 * 1000,
  });

  // 9. GENERATE DYNAMIC ALERTS (100% aligned with Dashboard & Overdue Single Source of Truth)
  const generatedAlerts = useMemo<PortalAlertItem[]>(() => {
    const list: PortalAlertItem[] = [];
    const now = getKarachiTodayNoon();
    const todayStr = getKarachiYmd(now);
    const nowTimeStr = format(new Date(), "HH:mm");
    const departureWindowDate = format(addDays(now, preferences.daysBeforeDeparture || 7), "yyyy-MM-dd");
    const dueWindowDate = format(addDays(now, preferences.daysBeforeDueDate || 3), "yyyy-MM-dd");

    // A. CLIENT PAYMENT & OVERDUE INVOICES
    // Primary source: booking_invoices (legacy clients checked ONLY if booking_invoices is empty)
    const processedInvoiceNos = new Set<string>();

    bookingInvoices.forEach((inv: any) => {
      if (isInvoiceVoidedOrRefunded(inv)) return;
      const clientAmt = Number(inv.client_amount) || 0;
      const paidAmt = Number(inv.paid_amount) || 0;
      const remaining = Math.max(0, clientAmt - paidAmt);
      if (remaining <= 0 || inv.payment_status === "paid") return;

      processedInvoiceNos.add(inv.invoice_no);

      const { isOverdue, dueDate } = getInvoiceOverdueInfo(inv, now);
      const isDueToday = dueDate === todayStr;
      const isDueSoon = dueDate > todayStr && dueDate <= dueWindowDate;

      const clientName = inv.party?.name || "Client";
      const id = `inv-${inv.id}`;

      if (isOverdue && preferences.invoiceOverdue) {
        list.push({
          id,
          title: `Overdue Invoice: ${inv.invoice_no} (${clientName})`,
          description: `Outstanding balance of PKR ${remaining.toLocaleString()} is overdue (Due: ${dueDate}).`,
          type: "accounts",
          priority: "overdue",
          dueDate,
          sourceId: inv.id,
          sourceType: "invoice",
          clientName,
          invoiceNo: inv.invoice_no,
          pnr: inv.pnr,
          ticketNo: inv.ticket_no,
          amount: remaining,
          isRead: readIds.has(id),
          isDone: doneIds.has(id),
          snoozedUntil: snoozeMap[id] || null,
          createdAt: inv.created_at || dueDate,
          mainAction: {
            label: "Receive Payment",
            modalType: "payment_voucher",
            modalProps: {
              partyId: inv.party_id,
              partyName: clientName,
              amount: remaining,
              invoiceNo: inv.invoice_no,
              direction: "in",
            },
          },
          secondaryAction: {
            label: "View Statement",
            url: `/app/reports?tab=account-statement&party=${inv.party_id || ""}`,
          },
        });
      } else if ((isDueToday || isDueSoon) && (preferences.paymentDueSoon || preferences.pendingClientPayment)) {
        list.push({
          id,
          title: `Payment ${isDueToday ? "Due Today" : "Due Soon"}: ${inv.invoice_no} (${clientName})`,
          description: `Pending balance of PKR ${remaining.toLocaleString()} due by ${dueDate}.`,
          type: "accounts",
          priority: isDueToday ? "due_today" : "upcoming",
          dueDate,
          sourceId: inv.id,
          sourceType: "invoice",
          clientName,
          invoiceNo: inv.invoice_no,
          pnr: inv.pnr,
          ticketNo: inv.ticket_no,
          amount: remaining,
          isRead: readIds.has(id),
          isDone: doneIds.has(id),
          snoozedUntil: snoozeMap[id] || null,
          createdAt: inv.created_at || dueDate,
          mainAction: {
            label: "Receive Payment",
            modalType: "payment_voucher",
            modalProps: {
              partyId: inv.party_id,
              partyName: clientName,
              amount: remaining,
              invoiceNo: inv.invoice_no,
              direction: "in",
            },
          },
          secondaryAction: {
            label: "View Statement",
            url: `/app/reports?tab=account-statement&party=${inv.party_id || ""}`,
          },
        });
      }
    });

    // Fallback: legacy clients table ONLY when booking_invoices has zero rows for this agency
    if (bookingInvoices.length === 0) {
      clientsData.forEach((c: any) => {
        if (isInvoiceVoidedOrRefunded(c)) return;
        const total = Number(c.selling_price) || 0;
        const paid = Number(c.amount_paid) || 0;
        const remaining = Math.max(0, total - paid);
        if (remaining <= 0 || c.payment_status?.toLowerCase() === "paid") return;

        const { isOverdue, dueDate } = getInvoiceOverdueInfo(c, now);
        const id = `client-due-${c.id}`;

        if (isOverdue && preferences.invoiceOverdue) {
          list.push({
            id,
            title: `Overdue Balance: ${c.name}`,
            description: `Outstanding balance of PKR ${remaining.toLocaleString()} is overdue (Due: ${dueDate}).`,
            type: "accounts",
            priority: "overdue",
            dueDate,
            sourceId: c.id,
            sourceType: "invoice",
            clientName: c.name,
            pnr: c.pnr,
            ticketNo: c.passport_number,
            amount: remaining,
            isRead: readIds.has(id),
            isDone: doneIds.has(id),
            snoozedUntil: snoozeMap[id] || null,
            createdAt: c.created_at || dueDate,
            mainAction: {
              label: "Receive Payment",
              modalType: "payment_voucher",
              modalProps: {
                partyName: c.name,
                amount: remaining,
                direction: "in",
              },
            },
          });
        }
      });
    }

    // B. VENDOR PAYABLES DUE (only supplier/both parties with genuine payable balance < 0)
    if (preferences.vendorPayableDue) {
      parties
        .filter((p) => p.type !== "client" && p.current_balance < 0)
        .forEach((v) => {
          const payableAmt = Math.abs(v.current_balance);
          const id = `vendor-pay-${v.id}`;
          list.push({
            id,
            title: `Vendor Payable Due: ${v.name}`,
            description: `Outstanding payable of PKR ${payableAmt.toLocaleString()} due on supplier ledger.`,
            type: "accounts",
            priority: "due_today",
            sourceId: v.id,
            sourceType: "party",
            vendorName: v.name,
            amount: payableAmt,
            isRead: readIds.has(id),
            isDone: doneIds.has(id),
            snoozedUntil: snoozeMap[id] || null,
            createdAt: v.created_at || todayStr,
            mainAction: {
              label: "Pay Vendor",
              modalType: "payment_voucher",
              modalProps: {
                partyId: v.id,
                partyName: v.name,
                amount: payableAmt,
                direction: "out",
              },
            },
            secondaryAction: {
              label: "View Ledger",
              url: `/app/reports?tab=party-ledger&party=${v.id}`,
            },
          });
        });
    }

    // C. UPCOMING FLIGHT & UMRAH DEPARTURES (within daysBeforeDeparture)
    if (preferences.upcomingDeparture) {
      // Check from booking_invoices
      bookingInvoices.forEach((inv: any) => {
        const details = inv.more_details || {};
        const flightDate = details.flight_date || details.departure_date;
        if (!flightDate) return;

        const dateStr = flightDate.slice(0, 10);
        if (dateStr >= todayStr && dateStr <= departureWindowDate) {
          const isDepartingToday = dateStr === todayStr;
          const isUmrah = (inv.service || "").toLowerCase().includes("umrah");
          const clientName = inv.party?.name || "Passenger";
          const id = `depart-${inv.id}`;

          list.push({
            id,
            title: `${isUmrah ? "🕋 Umrah Departure" : "✈️ Flight Departure"} ${isDepartingToday ? "TODAY" : "Soon"}: ${clientName}`,
            description: `${inv.service} booking (${inv.invoice_no || inv.pnr || "Flight"}) departs on ${dateStr}.`,
            type: "travel",
            priority: isDepartingToday ? "due_today" : "upcoming",
            dueDate: dateStr,
            sourceId: inv.id,
            sourceType: "booking",
            clientName,
            invoiceNo: inv.invoice_no,
            pnr: inv.pnr,
            ticketNo: inv.ticket_no,
            isRead: readIds.has(id),
            isDone: doneIds.has(id),
            snoozedUntil: snoozeMap[id] || null,
            createdAt: inv.created_at || dateStr,
            mainAction: {
              label: "View Booking",
              url: `/app/sales-expenses?tab=booking-invoice&search=${encodeURIComponent(inv.invoice_no || inv.pnr || "")}`,
            },
          });
        }
      });

      // Check from clients table
      clientsData.forEach((c: any) => {
        if (!c.flight_date) return;
        const dateStr = c.flight_date.slice(0, 10);
        if (dateStr >= todayStr && dateStr <= departureWindowDate) {
          const isDepartingToday = dateStr === todayStr;
          const isUmrah = (c.travel_type || "").toLowerCase().includes("umrah");
          const id = `client-depart-${c.id}`;

          if (!list.some((item) => item.id === id || (c.pnr && item.pnr === c.pnr))) {
            list.push({
              id,
              title: `${isUmrah ? "🕋 Umrah Departure" : "✈️ Flight Departure"} ${isDepartingToday ? "TODAY" : "Soon"}: ${c.name}`,
              description: `${c.travel_type || "Ticket"} to ${c.destination || "Destination"} departs on ${dateStr}.`,
              type: "travel",
              priority: isDepartingToday ? "due_today" : "upcoming",
              dueDate: dateStr,
              sourceId: c.id,
              sourceType: "booking",
              clientName: c.name,
              pnr: c.pnr,
              ticketNo: c.passport_number,
              isRead: readIds.has(id),
              isDone: doneIds.has(id),
              snoozedUntil: snoozeMap[id] || null,
              createdAt: c.created_at || dateStr,
              mainAction: {
                label: "View Booking",
                url: `/app/bookings?tab=clients&search=${encodeURIComponent(c.pnr || c.name || "")}`,
              },
            });
          }
        }
      });
    }

    // D. RECURRING EXPENSES DUE
    if (preferences.recurringExpenseDue) {
      expenses
        .filter((e: any) => e.is_recurring)
        .forEach((exp: any) => {
          const id = `rec-exp-${exp.id}`;
          list.push({
            id,
            title: `Recurring Expense Due: ${exp.expense_type}`,
            description: `Scheduled recurring expense of PKR ${Number(exp.amount || 0).toLocaleString()} (${exp.recurring_frequency || "monthly"}).`,
            type: "accounts",
            priority: "due_today",
            sourceId: exp.id,
            sourceType: "expense",
            amount: Number(exp.amount || 0),
            isRead: readIds.has(id),
            isDone: doneIds.has(id),
            snoozedUntil: snoozeMap[id] || null,
            createdAt: exp.created_at || todayStr,
            mainAction: {
              label: "Record Expense",
              modalType: "expense",
              modalProps: {
                category: exp.expense_type,
                amount: exp.amount,
                notes: exp.notes,
              },
            },
          });
        });
    }

    // E. PENDING REFUNDS FROM VENDOR
    if (preferences.pendingRefund) {
      refunds.slice(0, 3).forEach((rf: any) => {
        const id = `refund-${rf.id}`;
        list.push({
          id,
          title: `Pending Refund: ${rf.refund_no || "Refund Record"}`,
          description: `Tracked customer refund of PKR ${Number(rf.refund_amount || 0).toLocaleString()} (${rf.reason || "Processed"}).`,
          type: "accounts",
          priority: "info",
          sourceId: rf.id,
          sourceType: "refund",
          amount: Number(rf.refund_amount || 0),
          isRead: readIds.has(id),
          isDone: doneIds.has(id),
          snoozedUntil: snoozeMap[id] || null,
          createdAt: rf.created_at || todayStr,
          mainAction: {
            label: "Open Refund",
            url: `/app/sales-expenses?tab=refunds-voids`,
          },
        });
      });
    }

    // F. QUERY & QUOTE FOLLOW-UPS DUE
    if (preferences.queryQuoteFollowUp) {
      // Pending queries
      queries
        .filter((q: any) => q.status === "pending" || q.status === "in_progress")
        .slice(0, 5)
        .forEach((query: any) => {
          const isOverdue = query.due_date && query.due_date < todayStr;
          const isDueToday = query.due_date === todayStr;
          const id = `query-${query.id}`;

          list.push({
            id,
            title: `Follow-up Due: Inquiry for ${query.name || "Client"}`,
            description: `${query.travel_type || "Trip"}: ${query.notes || "Follow-up with client regarding requirements."}`,
            type: "reminders",
            priority: isOverdue ? "overdue" : isDueToday ? "due_today" : "upcoming",
            dueDate: query.due_date,
            sourceId: query.id,
            sourceType: "query",
            clientName: query.name,
            isRead: readIds.has(id),
            isDone: doneIds.has(id),
            snoozedUntil: snoozeMap[id] || null,
            createdAt: query.created_at || todayStr,
            mainAction: {
              label: "Open Query",
              url: `/app/leads-quotes?tab=queries`,
            },
          });
        });

      // Expiring quotations
      quotations
        .filter((q: any) => q.status === "sent" && q.valid_until)
        .forEach((qt: any) => {
          const isExpired = qt.valid_until < todayStr;
          const isExpiringSoon = qt.valid_until >= todayStr && qt.valid_until <= dueWindowDate;
          if (!isExpired && !isExpiringSoon) return;

          const id = `quote-${qt.id}`;
          list.push({
            id,
            title: `Quotation ${isExpired ? "Expired" : "Expiring Soon"}: ${qt.quotation_number}`,
            description: `Proposal for ${qt.client_name} (PKR ${Number(qt.total_amount || 0).toLocaleString()}) valid until ${qt.valid_until}.`,
            type: "reminders",
            priority: isExpired ? "overdue" : "due_today",
            dueDate: qt.valid_until,
            sourceId: qt.id,
            sourceType: "quote",
            clientName: qt.client_name,
            amount: Number(qt.total_amount || 0),
            isRead: readIds.has(id),
            isDone: doneIds.has(id),
            snoozedUntil: snoozeMap[id] || null,
            createdAt: qt.created_at || todayStr,
            mainAction: {
              label: "Open Quotation",
              url: `/app/leads-quotes?tab=quotations`,
            },
          });
        });
    }

    // G. END-OF-DAY CLOSING REMINDER
    if (preferences.endOfDayReminder) {
      const eodTime = preferences.endOfDayTime || "19:00";
      const isPastEod = nowTimeStr >= eodTime;
      const id = `eod-close-${todayStr}`;
      list.push({
        id,
        title: `End-of-Day Ledger Close & Expenses`,
        description: `Verify cash in hand, record daily operating expenses, and review today's vouchers.`,
        type: "accounts",
        priority: isPastEod ? "due_today" : "info",
        isRead: readIds.has(id),
        isDone: doneIds.has(id),
        snoozedUntil: snoozeMap[id] || null,
        createdAt: todayStr,
        mainAction: {
          label: "Record Daily Expenses",
          modalType: "expense",
        },
        secondaryAction: {
          label: "View Daily Report",
          url: `/app/reports?tab=daily-report`,
        },
      });
    }

    // H. LOW OR NEGATIVE CASH/BANK BALANCE
    if (preferences.lowBalanceAlert) {
      const cashBal = cashAccount?.current_balance || 0;
      if (cashBal < preferences.lowBalanceThreshold) {
        const id = `low-cash-${todayStr}`;
        list.push({
          id,
          title: `Low / Negative Cash Balance Alert`,
          description: `Current cash in hand is PKR ${cashBal.toLocaleString()}, which is below the threshold (PKR ${preferences.lowBalanceThreshold.toLocaleString()}).`,
          type: "accounts",
          priority: "overdue",
          isRead: readIds.has(id),
          isDone: doneIds.has(id),
          snoozedUntil: snoozeMap[id] || null,
          createdAt: todayStr,
          mainAction: {
            label: "View Cash Accounts",
            url: `/app/sales-expenses?tab=payment-vouchers`,
          },
        });
      }
    }

    // I. CUSTOM USER REMINDERS (from reminders table)
    customReminders.forEach((r: any) => {
      const isOverdue = r.remind_date < todayStr;
      const isDueToday = r.remind_date === todayStr;
      const id = `custom-rem-${r.id}`;

      list.push({
        id,
        title: r.title,
        description: r.notes || `Scheduled ${r.type || "task"} reminder at ${r.remind_time || "09:00"}.`,
        type: "reminders",
        priority: isOverdue ? "overdue" : isDueToday ? "due_today" : "upcoming",
        dueDate: r.remind_date,
        sourceId: r.id,
        sourceType: "reminder",
        isRead: readIds.has(id),
        isDone: doneIds.has(id) || Boolean(r.is_completed),
        snoozedUntil: snoozeMap[id] || null,
        createdAt: r.created_at || r.remind_date,
        mainAction: {
          label: "View Reminder",
          url: `/app/notifications?tab=reminders`,
        },
      });
    });

    // Deduplicate items by ID
    const uniqueMap = new Map<string, PortalAlertItem>();
    list.forEach((item) => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });

    return Array.from(uniqueMap.values());
  }, [
    bookingInvoices,
    clientsData,
    parties,
    expenses,
    refunds,
    queries,
    quotations,
    customReminders,
    cashAccount,
    preferences,
    readIds,
    doneIds,
    snoozeMap,
  ]);

  // Filter out snoozed items that are still in snooze window
  const activeAlerts = useMemo(() => {
    const nowIso = new Date().toISOString();
    return generatedAlerts.filter((item) => {
      if (item.isDone) return false;
      if (item.snoozedUntil && item.snoozedUntil > nowIso) return false;
      return true;
    });
  }, [generatedAlerts]);

  // Counts by tab
  const counts = useMemo(() => {
    const all = activeAlerts.filter((a) => !a.isRead).length;
    const travel = activeAlerts.filter((a) => a.type === "travel" && !a.isRead).length;
    const accounts = activeAlerts.filter((a) => a.type === "accounts" && !a.isRead).length;
    const reminders = activeAlerts.filter((a) => a.type === "reminders" && !a.isRead).length;
    return { all, travel, accounts, reminders, total: activeAlerts.length };
  }, [activeAlerts]);

  // Actions: Mark Read, Mark Done, Snooze, Dismiss, Mark All Read
  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      if (agencyId) {
        try {
          localStorage.setItem(scopedAlertKey(STORAGE_READ_KEY, agencyId), JSON.stringify(Array.from(next)));
        } catch (e) {
          console.warn("Could not save read alert ID:", e);
        }
      }
      return next;
    });
  }, [agencyId]);

  const markAllAsRead = useCallback(() => {
    const allIds = generatedAlerts.map((a) => a.id);
    setReadIds(new Set(allIds));
    if (agencyId) {
      try {
        localStorage.setItem(scopedAlertKey(STORAGE_READ_KEY, agencyId), JSON.stringify(allIds));
      } catch (e) {
        console.warn("Could not save all read alert IDs:", e);
      }
    }
    toast.success("All notifications marked as read");
  }, [generatedAlerts, agencyId]);

  const markAsDone = useCallback((id: string) => {
    setDoneIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      if (agencyId) {
        try {
          localStorage.setItem(scopedAlertKey(STORAGE_DONE_KEY, agencyId), JSON.stringify(Array.from(next)));
        } catch (e) {
          console.warn("Could not save done alert ID:", e);
        }
      }
      return next;
    });
    // Also mark read
    markAsRead(id);
    toast.success("Alert marked as completed");
  }, [markAsRead, agencyId]);

  const snoozeAlert = useCallback((id: string, duration: "1h" | "tonight" | "tomorrow" | "custom", customIso?: string) => {
    const now = new Date();
    let untilIso = "";

    if (duration === "1h") {
      untilIso = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    } else if (duration === "tonight") {
      const tonight = new Date();
      tonight.setHours(21, 0, 0, 0);
      untilIso = tonight.toISOString();
    } else if (duration === "tomorrow") {
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      tomorrow.setHours(9, 0, 0, 0);
      untilIso = tomorrow.toISOString();
    } else if (duration === "custom" && customIso) {
      untilIso = customIso;
    } else {
      untilIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }

    setSnoozeMap((prev) => {
      const next = { ...prev, [id]: untilIso };
      if (agencyId) {
        try {
          localStorage.setItem(scopedAlertKey(STORAGE_SNOOZE_KEY, agencyId), JSON.stringify(next));
        } catch (e) {
          console.warn("Could not save snooze map:", e);
        }
      }
      return next;
    });

    toast.info("Alert snoozed");
  }, [agencyId]);

  const dismissAlert = useCallback((id: string) => {
    markAsDone(id);
  }, [markAsDone]);

  return {
    allAlerts: generatedAlerts,
    activeAlerts,
    unreadCount: counts.all,
    counts,
    preferences,
    savePreferences,
    markAsRead,
    markAllAsRead,
    markAsDone,
    snoozeAlert,
    dismissAlert,
  };
}
