import { format, parseISO, startOfMonth, endOfMonth, subMonths, isValid } from "date-fns";
import { isInvoiceVoidedOrRefunded } from "@/lib/accountingEngine";
import { getKarachiTodayNoon, getKarachiYmd } from "@/lib/karachiTime";

export interface PartyLedgerPartyInput {
  id: string;
  name: string;
  code?: string | null;
  type: "client" | "vendor" | "both" | string;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  city?: string | null;
  credit_limit?: number | null;
  opening_balance?: number | null;
  current_balance?: number | null;
  active?: boolean;
  created_at?: string | null;
  isLegacyRecord?: boolean;
}

export type PartyLedgerEntryCategory =
  | "opening"
  | "invoice"
  | "payment"
  | "adjustment"
  | "refund"
  | "void";

export interface PartyLedgerEntry {
  id: string;
  date: string;
  type: string;
  category: PartyLedgerEntryCategory;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  balanceDrCr: "DR" | "CR" | "";
  balanceFormatted: string;
  isOpening: boolean;
  isVoided?: boolean;
  sourceKind?: "invoice" | "voucher" | "refund" | "opening";
  sourceRecord?: any;
  createdAtMs: number;
  typeSortRank: number;
}

export interface PartyLedgerResult {
  entriesNewestFirst: PartyLedgerEntry[];
  entriesOldestFirst: PartyLedgerEntry[];
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  storedCurrentBalance: number;
  hasMismatch: boolean;
  mismatchDiff: number;
}

export type LedgerDatePreset = "all" | "this_month" | "last_month" | "last_3_months" | "custom";
export type LedgerTypeFilter = "all" | "invoices" | "payments";

export interface PartyLedgerFilterOptions {
  datePreset?: LedgerDatePreset;
  customFrom?: string;
  customTo?: string;
  typeFilter?: LedgerTypeFilter;
  referenceSearch?: string;
  todayYmd?: string;
}

export interface FilteredPartyLedgerResult {
  rowsNewestFirst: PartyLedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export type StatementPeriodPreset =
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "all_time"
  | "custom";

export interface StatementPeriodResolution {
  preset: StatementPeriodPreset;
  fromDate: string | null;
  toDate: string | null;
  summaryText: string;
  endsToday: boolean;
}

export interface StatementValidationResult {
  valid: boolean;
  error: string | null;
}

export interface PartyStatementBuildResult {
  valid: boolean;
  error: string | null;
  party: PartyLedgerPartyInput;
  period: StatementPeriodResolution;
  broughtForward: number;
  broughtForwardFormatted: string;
  entries: PartyLedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  closingBalanceFormatted: string;
  isEmptyPeriod: boolean;
  emptyNote: string | null;
  hasMismatch: boolean;
  mismatchDiff: number;
  storedCurrentBalance: number;
}

export function roundMoney(val: number): number {
  const num = Number(val) || 0;
  const rounded = Math.round(num * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function getDrCrCode(balance: number): "DR" | "CR" | "" {
  const b = roundMoney(balance);
  if (b > 0.005) return "DR";
  if (b < -0.005) return "CR";
  return "";
}

export function formatDrCrAmount(balance: number, currency = "PKR"): string {
  const b = roundMoney(balance);
  if (Math.abs(b) <= 0.005) return `${currency} 0`;
  const code = b > 0 ? "DR" : "CR";
  return `${currency} ${Math.abs(b).toLocaleString()} ${code}`;
}

export function getDrCrLabelForParty(
  balance: number,
  partyType?: "client" | "vendor" | "both" | string
): {
  code: "DR" | "CR" | "";
  formatted: string;
  statusLabel: string;
} {
  const b = roundMoney(balance);
  const code = getDrCrCode(b);
  const formatted = formatDrCrAmount(b);

  if (code === "") {
    return { code: "", formatted, statusLabel: "Settled" };
  }

  if (partyType === "vendor") {
    return {
      code,
      formatted,
      statusLabel: code === "CR" ? "Payable (CR)" : "Advance / Receivable (DR)",
    };
  }

  if (partyType === "client") {
    return {
      code,
      formatted,
      statusLabel: code === "DR" ? "Receivable (DR)" : "Advance / Credit (CR)",
    };
  }

  return {
    code,
    formatted,
    statusLabel: code === "DR" ? "Receivable (DR)" : "Payable (CR)",
  };
}

function toYmdSafe(val?: string | null, fallbackYmd?: string): string {
  if (!val) return fallbackYmd || getKarachiYmd();
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    // Only use raw YYYY-MM-DD when it is a plain date (not a UTC timestamp with T/Z)
    if (str.length === 10) return str;
  }
  const ymd = getKarachiYmd(str);
  return ymd || fallbackYmd || getKarachiYmd();
}

function toTimestampMs(dateYmd: string, createdAt?: string | null): number {
  if (createdAt) {
    const parsed = Date.parse(createdAt);
    if (Number.isFinite(parsed)) return parsed;
  }
  const parsedDate = Date.parse(`${dateYmd}T00:00:00Z`);
  return Number.isFinite(parsedDate) ? parsedDate : 0;
}

export function extractInvoiceSector(inv: any): string {
  if (!inv) return "";
  const details = inv.more_details && typeof inv.more_details === "object" ? inv.more_details : {};
  if (details.origin && details.destination) {
    return `${details.origin} → ${details.destination}`;
  }
  if (details.sector) return String(details.sector);
  if (details.destination) return String(details.destination);
  if (details.country) return String(details.country);
  if (details.hotel_name) return String(details.hotel_name);
  if (details.city) return String(details.city);
  return "";
}

function buildShortInvoiceDescription(inv: any, extraParts: Array<string | null | undefined> = []): string {
  const sector = extractInvoiceSector(inv);
  const parts = [
    inv.service || null,
    sector || null,
    inv.pnr ? `PNR ${inv.pnr}` : null,
    ...extraParts,
    inv.notes ? String(inv.notes).trim() : null,
  ].filter(Boolean);
  const joined = parts.join(" · ");
  return joined.length > 110 ? `${joined.slice(0, 107)}...` : joined;
}

export interface BuildPartyLedgerInput {
  party: PartyLedgerPartyInput;
  bookingInvoices?: any[];
  paymentVouchers?: any[];
  refunds?: any[];
  refundVoidRecords?: any[];
  openingBalances?: any[];
  legacyClientRecord?: any | null;
  legacyClientPayments?: any[];
  legacyVendorBookings?: any[];
  legacyVendorPayments?: any[];
}

export function buildPartyLedger(input: BuildPartyLedgerInput): PartyLedgerResult {
  const {
    party,
    bookingInvoices = [],
    paymentVouchers = [],
    refunds = [],
    refundVoidRecords = [],
    openingBalances = [],
    legacyClientRecord = null,
    legacyClientPayments = [],
    legacyVendorBookings = [],
    legacyVendorPayments = [],
  } = input;

  const rawEntries: Array<Omit<PartyLedgerEntry, "runningBalance" | "balanceDrCr" | "balanceFormatted">> = [];
  const openingBalance = roundMoney(Number(party.opening_balance) || 0);
  const todayFallback = getKarachiYmd();

  const invById = new Map<string, any>();
  for (const inv of bookingInvoices) {
    if (inv?.id) invById.set(inv.id, inv);
  }

  const voidRecByInvoiceId = new Map<string, any>();
  const voidRecByNo = new Map<string, any>();
  for (const vr of refundVoidRecords) {
    if (vr?.invoice_id && !voidRecByInvoiceId.has(vr.invoice_id)) {
      voidRecByInvoiceId.set(vr.invoice_id, vr);
    }
    if (vr?.record_no) {
      voidRecByNo.set(vr.record_no, vr);
    }
  }

  const refundByBookingId = new Map<string, any>();
  for (const r of refunds) {
    if (r?.booking_id && !refundByBookingId.has(r.booking_id)) {
      refundByBookingId.set(r.booking_id, r);
    }
  }

  // 1. Opening Balance row (oldest base row)
  if (Math.abs(openingBalance) > 0.005) {
    const obRec = openingBalances[0];
    const obDate = toYmdSafe(obRec?.as_of_date || party.created_at, todayFallback);
    rawEntries.push({
      id: `opening-${party.id}`,
      date: obDate,
      type: "Opening",
      category: "opening",
      reference: "OPENING",
      description:
        obRec?.notes ||
        (openingBalance > 0 ? "Opening Balance (Receivable)" : "Opening Balance (Payable)"),
      debit: openingBalance > 0 ? openingBalance : 0,
      credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
      isOpening: true,
      sourceKind: "opening",
      sourceRecord: obRec || null,
      createdAtMs: 0,
      typeSortRank: 0,
    });
  }

  // 2. Booking Invoices (as client and/or as vendor)
  for (const inv of bookingInvoices) {
    const invDate = toYmdSafe(inv.invoice_date || inv.created_at, todayFallback);
    const createdMs = toTimestampMs(invDate, inv.created_at);
    const isVoided = isInvoiceVoidedOrRefunded(inv);
    const linkedVoidRec = voidRecByInvoiceId.get(inv.id);
    const linkedRefund = refundByBookingId.get(inv.id);
    const rawVoidDate = toYmdSafe(
      inv.voided_at || linkedVoidRec?.created_at || linkedRefund?.refund_date || invDate,
      invDate
    );
    const voidDate = rawVoidDate >= invDate ? rawVoidDate : invDate;
    const voidRef = linkedVoidRec?.record_no || linkedRefund?.refund_no || inv.invoice_no || "VOID";

    if (inv.party_id === party.id) {
      const amt = roundMoney(Number(inv.client_amount) || 0);
      rawEntries.push({
        id: `inv-client-${inv.id}`,
        date: invDate,
        type: "Invoice",
        category: "invoice",
        reference: inv.invoice_no || "INV",
        description: buildShortInvoiceDescription(inv) || "Booking Invoice",
        debit: amt,
        credit: 0,
        isOpening: false,
        isVoided,
        sourceKind: "invoice",
        sourceRecord: inv,
        createdAtMs: createdMs,
        typeSortRank: 1,
      });

      if (isVoided && amt > 0) {
        const reason = inv.void_reason || linkedVoidRec?.reason || linkedRefund?.reason;
        rawEntries.push({
          id: `void-client-${inv.id}`,
          date: voidDate,
          type: "Void",
          category: "void",
          reference: voidRef,
          description: `Voided ${inv.invoice_no || "invoice"}${reason ? ` · ${reason}` : ""}`,
          debit: 0,
          credit: amt,
          isOpening: false,
          sourceKind: "invoice",
          sourceRecord: inv,
          createdAtMs: Math.max(createdMs + 1, toTimestampMs(voidDate, inv.voided_at || linkedVoidRec?.created_at)),
          typeSortRank: 4,
        });
      }
    }

    if (inv.vendor_id === party.id) {
      const vendorAmt = roundMoney(Number(inv.vendor_payable) || 0);
      if (vendorAmt > 0) {
        const clientName = inv.party?.name || inv.client_name;
        rawEntries.push({
          id: `inv-vendor-${inv.id}`,
          date: invDate,
          type: "Booking",
          category: "invoice",
          reference: inv.invoice_no || "INV",
          description:
            buildShortInvoiceDescription(inv, [clientName ? `Client: ${clientName}` : null]) ||
            "Vendor Booking Payable",
          debit: 0,
          credit: vendorAmt,
          isOpening: false,
          isVoided,
          sourceKind: "invoice",
          sourceRecord: inv,
          createdAtMs: createdMs,
          typeSortRank: 1,
        });

        if (isVoided) {
          const reason = inv.void_reason || linkedVoidRec?.reason || linkedRefund?.reason;
          rawEntries.push({
            id: `void-vendor-${inv.id}`,
            date: voidDate,
            type: "Void",
            category: "void",
            reference: voidRef,
            description: `Voided ${inv.invoice_no || "booking"}${reason ? ` · ${reason}` : ""}`,
            debit: vendorAmt,
            credit: 0,
            isOpening: false,
            sourceKind: "invoice",
            sourceRecord: inv,
            createdAtMs: Math.max(createdMs + 1, toTimestampMs(voidDate, inv.voided_at || linkedVoidRec?.created_at)),
            typeSortRank: 4,
          });
        }
      }
    }
  }

  // 3. Payment Vouchers (Receipts, Payments, Adjustments, Voided Vouchers)
  for (const pv of paymentVouchers) {
    if (pv.party_id !== party.id) continue;
    const vDate = toYmdSafe(pv.voucher_date || pv.created_at, todayFallback);
    const createdMs = toTimestampMs(vDate, pv.created_at);
    const amt = roundMoney(Number(pv.amount) || 0);
    const dir = String(pv.direction || "").toLowerCase();
    const isAdj = Boolean(pv.is_adjustment);
    const isVoided = Boolean(pv.is_void);

    const typeLabel = isAdj
      ? dir === "received"
        ? "Adjustment (CRV)"
        : "Adjustment (CPV)"
      : dir === "received"
      ? "Receipt (CRV)"
      : "Payment (CPV)";

    const descParts = [
      pv.adjustment_reason || null,
      pv.notes || null,
      pv.reference_no ? `Ref: ${pv.reference_no}` : null,
      pv.payment_mode ? String(pv.payment_mode).toUpperCase() : null,
    ].filter(Boolean);

    rawEntries.push({
      id: `pv-${pv.id}`,
      date: vDate,
      type: typeLabel,
      category: isAdj ? "adjustment" : "payment",
      reference: pv.voucher_no || "VCH",
      description:
        descParts.join(" · ") ||
        (dir === "received" ? "Payment received" : "Payment made"),
      debit: dir === "paid" ? amt : 0,
      credit: dir === "received" ? amt : 0,
      isOpening: false,
      isVoided,
      sourceKind: "voucher",
      sourceRecord: pv,
      createdAtMs: createdMs,
      typeSortRank: 2,
    });

    if (isVoided && amt > 0) {
      const rawVoidDate = toYmdSafe(pv.voided_at || vDate, vDate);
      const voidDate = rawVoidDate >= vDate ? rawVoidDate : vDate;
      rawEntries.push({
        id: `pv-void-${pv.id}`,
        date: voidDate,
        type: "Void",
        category: "void",
        reference: pv.voucher_no || "VOID",
        description: `Voided voucher${pv.void_reason ? ` · ${pv.void_reason}` : ""}`,
        debit: dir === "received" ? amt : 0,
        credit: dir === "paid" ? amt : 0,
        isOpening: false,
        sourceKind: "voucher",
        sourceRecord: pv,
        createdAtMs: Math.max(createdMs + 1, toTimestampMs(voidDate, pv.voided_at)),
        typeSortRank: 4,
      });
    }
  }

  // 4. Refunds (cash refunds back to client & vendor refunds received from vendor)
  for (const r of refunds) {
    const linkedInv = r.booking_id ? invById.get(r.booking_id) : null;
    const linkedVoidRec =
      (r.booking_id && voidRecByInvoiceId.get(r.booking_id)) ||
      (r.refund_no && voidRecByNo.get(r.refund_no)) ||
      null;

    const rDate = toYmdSafe(r.refund_date || r.created_at, todayFallback);
    const createdMs = toTimestampMs(rDate, r.created_at);

    const isClientSide =
      r.party_id === party.id ||
      r.client_id === party.id ||
      linkedInv?.party_id === party.id;
    const isVendorSide =
      linkedInv?.vendor_id === party.id || linkedVoidRec?.vendor_id === party.id;

    const clientRefundAmt = roundMoney(Number(r.client_refund_amount ?? r.refund_amount) || 0);
    const vendorRefundAmt = roundMoney(Number(r.vendor_refund_amount) || 0);

    if (isClientSide && clientRefundAmt > 0) {
      const desc = [
        r.reason || null,
        r.notes || null,
        linkedInv?.invoice_no ? `Inv: ${linkedInv.invoice_no}` : null,
        r.payment_mode ? String(r.payment_mode).toUpperCase() : null,
      ]
        .filter(Boolean)
        .join(" · ");

      rawEntries.push({
        id: `ref-client-${r.id}`,
        date: rDate,
        type: "Refund",
        category: "refund",
        reference: r.refund_no || "REF",
        description: desc || "Client refund",
        debit: clientRefundAmt,
        credit: 0,
        isOpening: false,
        sourceKind: "refund",
        sourceRecord: r,
        createdAtMs: createdMs,
        typeSortRank: 3,
      });
    }

    if (isVendorSide && vendorRefundAmt > 0) {
      const desc = [
        r.reason || null,
        r.notes || null,
        linkedInv?.invoice_no ? `Inv: ${linkedInv.invoice_no}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      rawEntries.push({
        id: `ref-vendor-${r.id}`,
        date: rDate,
        type: "Vendor Refund",
        category: "refund",
        reference: r.refund_no || "REF",
        description: desc || "Vendor refund",
        debit: 0,
        credit: vendorRefundAmt,
        isOpening: false,
        sourceKind: "refund",
        sourceRecord: r,
        createdAtMs: createdMs,
        typeSortRank: 3,
      });
    }
  }

  // 5. Legacy-only fallback rows (only if party is synthesized from legacy clients/vendors)
  if (party.isLegacyRecord) {
    if (legacyClientRecord && (Number(legacyClientRecord.selling_price) || 0) > 0) {
      const cDate = toYmdSafe(legacyClientRecord.flight_date || legacyClientRecord.created_at, todayFallback);
      rawEntries.push({
        id: `legacy-client-${legacyClientRecord.id}`,
        date: cDate,
        type: "Booking",
        category: "invoice",
        reference: legacyClientRecord.pnr || `CLT-${String(legacyClientRecord.id).slice(0, 4).toUpperCase()}`,
        description: [legacyClientRecord.travel_type, legacyClientRecord.destination, legacyClientRecord.pnr ? `PNR ${legacyClientRecord.pnr}` : null]
          .filter(Boolean)
          .join(" · "),
        debit: roundMoney(Number(legacyClientRecord.selling_price) || 0),
        credit: 0,
        isOpening: false,
        createdAtMs: toTimestampMs(cDate, legacyClientRecord.created_at),
        typeSortRank: 1,
      });
    }
    for (const lp of legacyClientPayments) {
      const pDate = toYmdSafe(lp.payment_date || lp.created_at, todayFallback);
      rawEntries.push({
        id: `legacy-cpay-${lp.id}`,
        date: pDate,
        type: "Payment",
        category: "payment",
        reference: lp.payment_mode ? String(lp.payment_mode).toUpperCase() : "PAY",
        description: lp.notes || "Legacy client payment",
        debit: 0,
        credit: roundMoney(Number(lp.payment_amount) || 0),
        isOpening: false,
        createdAtMs: toTimestampMs(pDate, lp.created_at),
        typeSortRank: 2,
      });
    }
    for (const vb of legacyVendorBookings) {
      const bDate = toYmdSafe(vb.flight_date || vb.created_at, todayFallback);
      const cost = roundMoney(Number(vb.purchasing_price) || 0);
      if (cost > 0) {
        rawEntries.push({
          id: `legacy-vb-${vb.id}`,
          date: bDate,
          type: "Booking",
          category: "invoice",
          reference: vb.pnr || `BK-${String(vb.id).slice(0, 4).toUpperCase()}`,
          description: [vb.name, vb.destination, vb.pnr ? `PNR ${vb.pnr}` : null].filter(Boolean).join(" · "),
          debit: 0,
          credit: cost,
          isOpening: false,
          createdAtMs: toTimestampMs(bDate, vb.created_at),
          typeSortRank: 1,
        });
      }
    }
    for (const vp of legacyVendorPayments) {
      const pDate = toYmdSafe(vp.payment_date || vp.created_at, todayFallback);
      rawEntries.push({
        id: `legacy-vpay-${vp.id}`,
        date: pDate,
        type: "Payment",
        category: "payment",
        reference: vp.payment_mode ? String(vp.payment_mode).toUpperCase() : "PAY",
        description: vp.notes || "Legacy vendor payment",
        debit: roundMoney(Number(vp.payment_amount) || 0),
        credit: 0,
        isOpening: false,
        createdAtMs: toTimestampMs(pDate, vp.created_at),
        typeSortRank: 2,
      });
    }
  }

  // Sort chronologically OLDEST TO NEWEST
  const sortedAsc = [...rawEntries].sort((a, b) => {
    if (a.isOpening !== b.isOpening) return a.isOpening ? -1 : 1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.createdAtMs !== b.createdAtMs) return a.createdAtMs - b.createdAtMs;
    if (a.typeSortRank !== b.typeSortRank) return a.typeSortRank - b.typeSortRank;
    return a.id.localeCompare(b.id);
  });

  // Compute running balance oldest-to-newest
  let running = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const entriesOldestFirst: PartyLedgerEntry[] = sortedAsc.map((entry) => {
    running = roundMoney(running + entry.debit - entry.credit);
    totalDebit = roundMoney(totalDebit + entry.debit);
    totalCredit = roundMoney(totalCredit + entry.credit);

    return {
      ...entry,
      runningBalance: running,
      balanceDrCr: getDrCrCode(running),
      balanceFormatted: formatDrCrAmount(running),
    };
  });

  const entriesNewestFirst = [...entriesOldestFirst].reverse();
  const closingBalance = entriesOldestFirst.length > 0 ? running : openingBalance;
  const storedCurrentBalance = roundMoney(Number(party.current_balance) || 0);
  const mismatchDiff = roundMoney(closingBalance - storedCurrentBalance);
  const hasMismatch = Math.abs(mismatchDiff) > 0.01;

  return {
    entriesNewestFirst,
    entriesOldestFirst,
    openingBalance,
    totalDebit,
    totalCredit,
    closingBalance,
    storedCurrentBalance,
    hasMismatch,
    mismatchDiff,
  };
}

export function resolveLedgerFilterDates(
  preset: LedgerDatePreset = "all",
  customFrom?: string,
  customTo?: string,
  todayYmd: string = getKarachiYmd()
): { fromDate: string | null; toDate: string | null } {
  const anchor = parseISO(todayYmd);
  const baseDate = isValid(anchor) ? anchor : getKarachiTodayNoon();

  if (preset === "this_month") {
    return {
      fromDate: format(startOfMonth(baseDate), "yyyy-MM-dd"),
      toDate: format(endOfMonth(baseDate), "yyyy-MM-dd"),
    };
  }
  if (preset === "last_month") {
    const lm = subMonths(baseDate, 1);
    return {
      fromDate: format(startOfMonth(lm), "yyyy-MM-dd"),
      toDate: format(endOfMonth(lm), "yyyy-MM-dd"),
    };
  }
  if (preset === "last_3_months") {
    return {
      fromDate: format(startOfMonth(subMonths(baseDate, 2)), "yyyy-MM-dd"),
      toDate: todayYmd,
    };
  }
  if (preset === "custom") {
    return {
      fromDate: customFrom?.trim() || null,
      toDate: customTo?.trim() || null,
    };
  }
  return { fromDate: null, toDate: null };
}

export function filterPartyLedgerRows(
  ledger: PartyLedgerResult,
  options: PartyLedgerFilterOptions = {}
): FilteredPartyLedgerResult {
  const {
    datePreset = "all",
    customFrom,
    customTo,
    typeFilter = "all",
    referenceSearch = "",
    todayYmd = getKarachiYmd(),
  } = options;

  const { fromDate, toDate } = resolveLedgerFilterDates(datePreset, customFrom, customTo, todayYmd);
  const refQ = referenceSearch.trim().toLowerCase();

  const rowsNewestFirst = ledger.entriesNewestFirst.filter((row) => {
    if (fromDate && row.date < fromDate) return false;
    if (toDate && row.date > toDate) return false;

    if (typeFilter === "invoices" && row.category !== "invoice") return false;
    if (typeFilter === "payments" && row.category !== "payment" && row.category !== "adjustment") {
      return false;
    }

    if (refQ) {
      const refMatch = row.reference.toLowerCase().includes(refQ);
      const descMatch = row.description.toLowerCase().includes(refQ);
      if (!refMatch && !descMatch) return false;
    }

    return true;
  });

  let totalDebit = 0;
  let totalCredit = 0;
  for (const row of rowsNewestFirst) {
    totalDebit = roundMoney(totalDebit + row.debit);
    totalCredit = roundMoney(totalCredit + row.credit);
  }

  const closingBalance =
    rowsNewestFirst.length > 0
      ? rowsNewestFirst[0].runningBalance
      : ledger.closingBalance;

  return {
    rowsNewestFirst,
    totalDebit,
    totalCredit,
    closingBalance,
  };
}

function isStrictValidYmd(val?: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const [y, m, d] = trimmed.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function validateStatementPeriod(
  preset: StatementPeriodPreset,
  customFrom?: string | null,
  customTo?: string | null
): StatementValidationResult {
  if (preset !== "custom") {
    return { valid: true, error: null };
  }

  const from = (customFrom || "").trim();
  const to = (customTo || "").trim();

  if (!from || !to) {
    return {
      valid: false,
      error: "Please select both From and To dates.",
    };
  }

  if (!isStrictValidYmd(from) || !isStrictValidYmd(to)) {
    return {
      valid: false,
      error: "Please enter valid dates.",
    };
  }

  if (from > to) {
    return {
      valid: false,
      error: "From date must not be after To date.",
    };
  }

  return { valid: true, error: null };
}

function formatDisplayDate(ymd: string): string {
  try {
    const parsed = parseISO(ymd);
    if (!isValid(parsed)) return ymd;
    return format(parsed, "dd MMM yyyy");
  } catch {
    return ymd;
  }
}

export function resolveStatementPeriod(
  preset: StatementPeriodPreset,
  customFrom?: string | null,
  customTo?: string | null,
  todayYmd: string = getKarachiYmd()
): StatementPeriodResolution {
  const anchor = parseISO(todayYmd);
  const baseDate = isValid(anchor) ? anchor : getKarachiTodayNoon();

  if (preset === "this_month") {
    const fromDate = format(startOfMonth(baseDate), "yyyy-MM-dd");
    const toDate = todayYmd;
    return {
      preset,
      fromDate,
      toDate,
      summaryText: `Statement from ${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}`,
      endsToday: true,
    };
  }

  if (preset === "last_month") {
    const lm = subMonths(baseDate, 1);
    const fromDate = format(startOfMonth(lm), "yyyy-MM-dd");
    const toDate = format(endOfMonth(lm), "yyyy-MM-dd");
    return {
      preset,
      fromDate,
      toDate,
      summaryText: `Statement from ${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}`,
      endsToday: toDate === todayYmd,
    };
  }

  if (preset === "last_3_months") {
    const fromDate = format(startOfMonth(subMonths(baseDate, 2)), "yyyy-MM-dd");
    const toDate = todayYmd;
    return {
      preset,
      fromDate,
      toDate,
      summaryText: `Statement from ${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}`,
      endsToday: true,
    };
  }

  if (preset === "all_time") {
    return {
      preset,
      fromDate: null,
      toDate: null,
      summaryText: `Statement for all time up to ${formatDisplayDate(todayYmd)}`,
      endsToday: true,
    };
  }

  const fromDate = (customFrom || "").trim() || null;
  const toDate = (customTo || "").trim() || null;
  const summaryText =
    fromDate && toDate && isStrictValidYmd(fromDate) && isStrictValidYmd(toDate) && fromDate <= toDate
      ? `Statement from ${formatDisplayDate(fromDate)} to ${formatDisplayDate(toDate)}`
      : "Select From and To dates";

  return {
    preset: "custom",
    fromDate,
    toDate,
    summaryText,
    endsToday: toDate === todayYmd,
  };
}

export function buildPartyStatement(opts: {
  party: PartyLedgerPartyInput;
  ledger: PartyLedgerResult;
  preset: StatementPeriodPreset;
  customFrom?: string | null;
  customTo?: string | null;
  todayYmd?: string;
}): PartyStatementBuildResult {
  const todayYmd = opts.todayYmd || getKarachiYmd();
  const validation = validateStatementPeriod(opts.preset, opts.customFrom, opts.customTo);
  const period = resolveStatementPeriod(opts.preset, opts.customFrom, opts.customTo, todayYmd);

  const nonOpeningEntries = opts.ledger.entriesOldestFirst.filter((e) => !e.isOpening);
  const openingBalance = opts.ledger.openingBalance;
  const storedCurrentBalance = opts.ledger.storedCurrentBalance;

  if (!validation.valid) {
    return {
      valid: false,
      error: validation.error,
      party: opts.party,
      period,
      broughtForward: openingBalance,
      broughtForwardFormatted: formatDrCrAmount(openingBalance),
      entries: [],
      totalDebit: 0,
      totalCredit: 0,
      closingBalance: openingBalance,
      closingBalanceFormatted: formatDrCrAmount(openingBalance),
      isEmptyPeriod: true,
      emptyNote: null,
      hasMismatch: false,
      mismatchDiff: 0,
      storedCurrentBalance,
    };
  }

  // Calculate Balance Brought Forward:
  // - For All time: brought forward = opening balance
  // - For bounded [fromDate, toDate]: opening balance + all earlier non-opening entries (date < fromDate)
  let broughtForward = openingBalance;
  let inPeriodRaw: PartyLedgerEntry[];

  if (opts.preset === "all_time" || !period.fromDate || !period.toDate) {
    inPeriodRaw = nonOpeningEntries;
  } else {
    const fromDate = period.fromDate;
    const toDate = period.toDate;
    for (const entry of nonOpeningEntries) {
      if (entry.date < fromDate) {
        broughtForward = roundMoney(broughtForward + entry.debit - entry.credit);
      }
    }
    inPeriodRaw = nonOpeningEntries.filter(
      (entry) => entry.date >= fromDate && entry.date <= toDate
    );
  }

  let running = broughtForward;
  let totalDebit = 0;
  let totalCredit = 0;

  const entries: PartyLedgerEntry[] = inPeriodRaw.map((entry) => {
    running = roundMoney(running + entry.debit - entry.credit);
    totalDebit = roundMoney(totalDebit + entry.debit);
    totalCredit = roundMoney(totalCredit + entry.credit);
    return {
      ...entry,
      runningBalance: running,
      balanceDrCr: getDrCrCode(running),
      balanceFormatted: formatDrCrAmount(running),
    };
  });

  const closingBalance = roundMoney(broughtForward + totalDebit - totalCredit);
  const isEmptyPeriod = entries.length === 0;
  const mismatchDiff = period.endsToday ? roundMoney(closingBalance - storedCurrentBalance) : 0;
  const hasMismatch = period.endsToday && Math.abs(mismatchDiff) > 0.01;

  return {
    valid: true,
    error: null,
    party: opts.party,
    period,
    broughtForward,
    broughtForwardFormatted: formatDrCrAmount(broughtForward),
    entries,
    totalDebit,
    totalCredit,
    closingBalance,
    closingBalanceFormatted: formatDrCrAmount(closingBalance),
    isEmptyPeriod,
    emptyNote: isEmptyPeriod ? "No transactions in this period" : null,
    hasMismatch,
    mismatchDiff,
    storedCurrentBalance,
  };
}

export function buildStatementWhatsAppText(
  statement: PartyStatementBuildResult,
  agencyName?: string | null
): string {
  const partyCode = statement.party.code ? ` (${statement.party.code})` : "";
  const lines: string[] = [
    `*Account Statement*${agencyName ? ` — ${agencyName}` : ""}`,
    `*Party:* ${statement.party.name}${partyCode}`,
    `*Period:* ${statement.period.summaryText}`,
    `*Balance Brought Forward:* ${statement.broughtForwardFormatted}`,
    "",
  ];

  if (statement.isEmptyPeriod) {
    lines.push("_No transactions in this period._");
  } else {
    const previewEntries = statement.entries.slice(0, 15);
    for (const e of previewEntries) {
      const amtPart =
        e.debit > 0
          ? `Dr PKR ${e.debit.toLocaleString()}`
          : `Cr PKR ${e.credit.toLocaleString()}`;
      lines.push(`• ${e.date} | ${e.reference} (${e.type}): ${amtPart} → ${e.balanceFormatted}`);
    }
    if (statement.entries.length > previewEntries.length) {
      lines.push(`...and ${statement.entries.length - previewEntries.length} more entries (see PDF statement).`);
    }
  }

  lines.push("");
  lines.push(`*Total Debit:* PKR ${statement.totalDebit.toLocaleString()}`);
  lines.push(`*Total Credit:* PKR ${statement.totalCredit.toLocaleString()}`);
  lines.push(`*Closing Balance:* ${statement.closingBalanceFormatted}`);

  return lines.join("\n");
}

