import { cleanPastedSearch } from "@/lib/searchUtils";

export interface GlobalSearchParty {
  id: string;
  name: string;
  type: "client" | "vendor" | "both" | string;
  code?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  passport?: string | null;
  current_balance?: number | null;
}

export interface GlobalSearchInvoice {
  id: string;
  invoice_no: string;
  invoice_date: string | null;
  created_at?: string | null;
  party_id?: string | null;
  party_name?: string | null;
  vendor_id?: string | null;
  vendor_name?: string | null;
  service?: string | null;
  total: number;
  paid: number;
  remaining: number;
  payment_status?: string | null;
  pnr?: string | null;
  ticket_no?: string | null;
  passport_no?: string | null;
  is_void?: boolean;
}

export interface GlobalSearchVoucher {
  id: string;
  voucher_no: string;
  voucher_date: string | null;
  created_at?: string | null;
  direction?: "in" | "out" | string;
  payment_mode?: string | null;
  amount: number;
  party_id?: string | null;
  party_name?: string | null;
  reference_no?: string | null;
  is_void?: boolean;
}

export interface GlobalSearchResponse {
  query: string;
  limit: number;
  offset: number;
  parties: GlobalSearchParty[];
  invoices: GlobalSearchInvoice[];
  vouchers: GlobalSearchVoucher[];
  has_more: boolean;
  parties_has_more: boolean;
  invoices_has_more: boolean;
  vouchers_has_more: boolean;
}

export const GLOBAL_SEARCH_MIN_CHARS = 2;
export const GLOBAL_SEARCH_PAGE_SIZE = 50;
export const GLOBAL_SEARCH_DEBOUNCE_MS = 300;

export function normalizeGlobalSearchQuery(raw: string): string {
  return cleanPastedSearch(String(raw || "")).replace(/\s+/g, " ").trim();
}

export function shouldTriggerGlobalSearch(raw: string): boolean {
  return normalizeGlobalSearchQuery(raw).length >= GLOBAL_SEARCH_MIN_CHARS;
}

function toTimestamp(primaryDate?: string | null, fallbackCreatedAt?: string | null): number {
  if (primaryDate) {
    const parsed = Date.parse(primaryDate);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (fallbackCreatedAt) {
    const parsed = Date.parse(fallbackCreatedAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function sortInvoicesNewestFirst<
  T extends { invoice_date?: string | null; created_at?: string | null }
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const dDiff = toTimestamp(b.invoice_date, null) - toTimestamp(a.invoice_date, null);
    if (dDiff !== 0) return dDiff;
    return toTimestamp(b.created_at, null) - toTimestamp(a.created_at, null);
  });
}

export function sortVouchersNewestFirst<
  T extends { voucher_date?: string | null; created_at?: string | null }
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const dDiff = toTimestamp(b.voucher_date, null) - toTimestamp(a.voucher_date, null);
    if (dDiff !== 0) return dDiff;
    return toTimestamp(b.created_at, null) - toTimestamp(a.created_at, null);
  });
}

function dedupeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((r) => r.id));
  const merged = [...existing];
  for (const row of incoming) {
    if (row?.id && !seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }
  return merged;
}

export function mergeGlobalSearchPage(
  previous: GlobalSearchResponse | null,
  next: GlobalSearchResponse
): GlobalSearchResponse {
  if (!previous || next.offset === 0) {
    return {
      ...next,
      parties: Array.isArray(next.parties) ? next.parties : [],
      invoices: sortInvoicesNewestFirst(Array.isArray(next.invoices) ? next.invoices : []),
      vouchers: sortVouchersNewestFirst(Array.isArray(next.vouchers) ? next.vouchers : []),
    };
  }

  return {
    ...next,
    parties: dedupeById(previous.parties, next.parties || []),
    invoices: sortInvoicesNewestFirst(dedupeById(previous.invoices, next.invoices || [])),
    vouchers: sortVouchersNewestFirst(dedupeById(previous.vouchers, next.vouchers || [])),
  };
}

