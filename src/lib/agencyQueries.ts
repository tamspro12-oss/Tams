import { supabase } from "@/integrations/supabase/client";
import { getKarachiYmd } from "@/lib/karachiTime";

export async function fetchAgencyBookingInvoices(agencyId: string) {
  const { data, error } = await (supabase as any)
    .from("booking_invoices")
    .select("*, party:parties!party_id(name, phone), vendor:parties!vendor_id(name)")
    .eq("agency_id", agencyId)
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchAgencyPaymentVouchers(agencyId: string) {
  const { data, error } = await (supabase as any)
    .from("payment_vouchers")
    .select("*, party:parties!party_id(name, phone)")
    .eq("agency_id", agencyId)
    .order("voucher_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchAgencyExpenses(agencyId: string) {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("agency_id", agencyId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchAgencyRefunds(agencyId: string) {
  const { data, error } = await supabase
    .from("refunds")
    .select("*")
    .eq("agency_id", agencyId)
    .order("refund_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchAgencyClients(agencyId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export function mapLegacyClientsToInvoices(clientsData: any[]): any[] {
  return (clientsData || []).map((c: any) => ({
    id: c.id,
    invoice_no: `INV-${c.id.slice(0, 4).toUpperCase()}`,
    invoice_date: c.flight_date || (c.created_at ? getKarachiYmd(c.created_at) : ""),
    created_at: c.created_at,
    service: c.travel_type || "Ticket",
    client_name: c.name,
    party: { name: c.name },
    client_amount: c.selling_price || 0,
    vendor_payable: c.purchasing_price || 0,
    profit: (c.selling_price || 0) - (c.purchasing_price || 0),
    paid_amount: c.amount_paid || 0,
    payment_status: (c.payment_status || "Pending").toLowerCase(),
    is_void: ["void", "refunded", "cancelled"].includes((c.payment_status || "").toLowerCase()),
    pnr: c.pnr,
    ticket_no: c.passport_number,
    more_details: { remaining_due_date: c.remaining_payment_date },
    remaining_payment_date: c.remaining_payment_date,
    _isLegacyClientFallback: true,
  }));
}

