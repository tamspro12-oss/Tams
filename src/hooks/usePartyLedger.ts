import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAgencyId } from "@/hooks/useCurrentAgencyId";
import { getAuthenticatedAgencyId } from "@/lib/agencyContext";
import {
  buildPartyLedger,
  type PartyLedgerPartyInput,
  type PartyLedgerResult,
} from "@/lib/partyLedger";

export function usePartyLedger(party: PartyLedgerPartyInput | null | undefined) {
  const { data: agencyId } = useCurrentAgencyId();
  const partyId = party?.id || null;

  const query = useQuery<PartyLedgerResult>({
    queryKey: [
      "party_ledger",
      agencyId,
      partyId,
      party?.opening_balance ?? 0,
      party?.current_balance ?? 0,
      Boolean(party?.isLegacyRecord),
    ],
    enabled: Boolean(agencyId && partyId && party),
    queryFn: async () => {
      const activeAgencyId = agencyId || (await getAuthenticatedAgencyId());
      if (!activeAgencyId || !partyId || !party) {
        return buildPartyLedger({
          party: party || {
            id: "",
            name: "",
            type: "client",
            opening_balance: 0,
            current_balance: 0,
          },
        });
      }

      const [invRes, pvRes, refRes, voidRecRes, obRes] = await Promise.all([
        (supabase as any)
          .from("booking_invoices")
          .select("*, party:parties!party_id(name), vendor:parties!vendor_id(name)")
          .eq("agency_id", activeAgencyId)
          .or(`party_id.eq.${partyId},vendor_id.eq.${partyId}`)
          .order("invoice_date", { ascending: true })
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("payment_vouchers")
          .select("*")
          .eq("agency_id", activeAgencyId)
          .eq("party_id", partyId)
          .order("voucher_date", { ascending: true })
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("refunds")
          .select("*")
          .eq("agency_id", activeAgencyId)
          .order("refund_date", { ascending: true })
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("refund_void_records")
          .select("*")
          .eq("agency_id", activeAgencyId)
          .or(`party_id.eq.${partyId},vendor_id.eq.${partyId}`)
          .order("created_at", { ascending: true }),
        (supabase as any)
          .from("opening_balances")
          .select("*")
          .eq("agency_id", activeAgencyId)
          .eq("party_id", partyId)
          .order("created_at", { ascending: true }),
      ]);

      if (invRes.error) throw invRes.error;
      if (pvRes.error) throw pvRes.error;
      if (refRes.error) throw refRes.error;

      const bookingInvoices: any[] = invRes.data || [];
      const partyInvoiceIds = new Set(bookingInvoices.map((i: any) => i.id));

      // Include refunds linked directly to this party OR linked to one of this party's invoices (client or vendor side)
      const allAgencyRefunds: any[] = refRes.data || [];
      const relevantRefunds = allAgencyRefunds.filter(
        (r: any) =>
          r.party_id === partyId ||
          r.client_id === partyId ||
          (r.booking_id && partyInvoiceIds.has(r.booking_id))
      );

      // Ignore missing optional table error for refund_void_records / opening_balances if not present
      const refundVoidRecords: any[] = voidRecRes.error ? [] : voidRecRes.data || [];
      const openingBalances: any[] = obRes.error ? [] : obRes.data || [];

      let legacyClientRecord: any | null = null;
      let legacyClientPayments: any[] = [];
      let legacyVendorBookings: any[] = [];
      let legacyVendorPayments: any[] = [];

      if (party.isLegacyRecord) {
        if (party.type === "client") {
          const [clRes, cpRes] = await Promise.all([
            supabase
              .from("clients")
              .select("*")
              .eq("agency_id", activeAgencyId)
              .eq("id", partyId)
              .maybeSingle(),
            supabase
              .from("client_payment_history")
              .select("*")
              .eq("agency_id", activeAgencyId)
              .eq("client_id", partyId)
              .order("payment_date", { ascending: true }),
          ]);
          if (clRes.error) throw clRes.error;
          legacyClientRecord = clRes.data || null;
          legacyClientPayments = cpRes.error ? [] : cpRes.data || [];
        } else if (party.type === "vendor") {
          const [vbRes, vpRes] = await Promise.all([
            supabase
              .from("clients")
              .select("*")
              .eq("agency_id", activeAgencyId)
              .eq("vendor_id", partyId)
              .order("created_at", { ascending: true }),
            supabase
              .from("vendor_payment_history")
              .select("*")
              .eq("agency_id", activeAgencyId)
              .eq("vendor_id", partyId)
              .order("payment_date", { ascending: true }),
          ]);
          legacyVendorBookings = vbRes.error ? [] : vbRes.data || [];
          legacyVendorPayments = vpRes.error ? [] : vpRes.data || [];
        }
      }

      return buildPartyLedger({
        party,
        bookingInvoices,
        paymentVouchers: pvRes.data || [],
        refunds: relevantRefunds,
        refundVoidRecords,
        openingBalances,
        legacyClientRecord,
        legacyClientPayments,
        legacyVendorBookings,
        legacyVendorPayments,
      });
    },
  });

  const emptyLedger = useMemo<PartyLedgerResult>(
    () =>
      buildPartyLedger({
        party: party || {
          id: "",
          name: "",
          type: "client",
          opening_balance: 0,
          current_balance: 0,
        },
      }),
    [party]
  );

  return {
    ledger: query.data ?? emptyLedger,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}

