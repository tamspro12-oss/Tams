import { getInvoiceOverdueInfo } from "@/lib/overdueUtils";
import { isInvoiceVoidedOrRefunded } from "@/lib/accountingEngine";
import type { StatementRow } from "@/lib/reportPdfGenerator";

export interface AccountStatementLedgerRow extends StatementRow {
  id: string;
  description: string;
  entry: string;
  overdue_days: number | null;
  raw_party_id?: string;
  vendor_id?: string;
  raw_vendor_id?: string;
  vendor_name?: string;
  party_keys?: string[];
  payment_status?: string;
  is_void?: boolean;
  search_text?: string;
}

export interface BuildAccountStatementParams {
  rawInvoices?: any[];
  rawTransactions?: any[];
  rawExpenses?: any[];
  rawRefunds?: any[];
  parties?: any[];
  detailedView?: boolean;
}

export interface AccountStatementFilterCriteria {
  datePreset?: string;
  fromDate?: string;
  toDate?: string;
  selectedPartyIds?: string[];
  onlyUnpaid?: boolean;
  overdueBucket?: string;
  detailedView?: boolean;
  status?: string;
  searchQuery?: string;
}

function normalizeNameKey(name?: string | null): string {
  if (!name) return "";
  return String(name).trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Extracts plain YYYY-MM-DD string without any timezone conversion.
 */
export function toPlainYmd(dateInput?: string | Date | null): string {
  if (!dateInput) return "";
  if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) return "";
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, "0");
    const d = String(dateInput.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const trimmed = String(dateInput).trim();
  // Match YYYY-MM-DD or YYYY-M-D or YYYY/MM/DD prefix
  const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, "0");
    const d = ymdMatch[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // Match DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, "0");
    const m = dmyMatch[2].padStart(2, "0");
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }
  return trimmed.slice(0, 10);
}

/**
 * Resolves a date preset (today, yesterday, this_month, last_month, this_year, custom, all)
 * into plain YYYY-MM-DD { fromDate, toDate } strings with no timezone shifting.
 */
export function resolveStatementDateRange(
  preset: string = "this_month",
  customFrom?: string,
  customTo?: string,
  now: Date = new Date()
): { fromDate: string; toDate: string } {
  const todayYmd = toPlainYmd(now);
  const [year, month, day] = todayYmd.split("-").map(Number);

  if (preset === "today") {
    return { fromDate: todayYmd, toDate: todayYmd };
  }
  if (preset === "yesterday") {
    const yest = new Date(year, month - 1, day - 1);
    const yStr = toPlainYmd(yest);
    return { fromDate: yStr, toDate: yStr };
  }
  if (preset === "this_month") {
    const lastDay = new Date(year, month, 0).getDate();
    const mStr = String(month).padStart(2, "0");
    return {
      fromDate: `${year}-${mStr}-01`,
      toDate: `${year}-${mStr}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  if (preset === "last_month") {
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    const lastDay = new Date(prevYear, prevMonth, 0).getDate();
    const mStr = String(prevMonth).padStart(2, "0");
    return {
      fromDate: `${prevYear}-${mStr}-01`,
      toDate: `${prevYear}-${mStr}-${String(lastDay).padStart(2, "0")}`,
    };
  }
  if (preset === "this_year") {
    return {
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
    };
  }
  if (preset === "all") {
    return { fromDate: "", toDate: "" };
  }
  if (preset === "custom") {
    return {
      fromDate: toPlainYmd(customFrom),
      toDate: toPlainYmd(customTo),
    };
  }

  const lastDay = new Date(year, month, 0).getDate();
  const mStr = String(month).padStart(2, "0");
  return {
    fromDate: `${year}-${mStr}-01`,
    toDate: `${year}-${mStr}-${String(lastDay).padStart(2, "0")}`,
  };
}

/**
 * Compares dates purely as plain YYYY-MM-DD strings (no timezone conversion).
 */
export function isPlainYmdInRange(
  dateStr: string | undefined | null,
  fromDate?: string,
  toDate?: string,
  datePreset?: string
): boolean {
  if (datePreset === "all") return true;
  const d = toPlainYmd(dateStr);
  if (!d) return false;
  const from = toPlainYmd(fromDate);
  const to = toPlainYmd(toDate);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function getOverdueDaysForInvoice(inv: any): number | null {
  const { isOverdue, overdueDays } = getInvoiceOverdueInfo(inv);
  return isOverdue && overdueDays > 0 ? overdueDays : null;
}

function extractPartyNameFromRelation(rel: any): string {
  if (!rel) return "";
  if (Array.isArray(rel)) {
    return String(rel[0]?.name || "").trim();
  }
  if (typeof rel === "object") {
    return String(rel.name || "").trim();
  }
  return "";
}

function extractPassengerNames(passengers: any): string[] {
  if (!passengers) return [];
  let list = passengers;
  if (typeof passengers === "string") {
    try {
      list = JSON.parse(passengers);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((p: any) => String(p?.name || "").trim())
    .filter(Boolean);
}

function extractMoreDetailsClientName(moreDetails: any): string {
  if (!moreDetails) return "";
  let obj = moreDetails;
  if (typeof moreDetails === "string") {
    try {
      obj = JSON.parse(moreDetails);
    } catch {
      return "";
    }
  }
  if (obj && typeof obj === "object") {
    return String(obj.client_name || obj.party_name || "").trim();
  }
  return "";
}

function createPartyLookups(parties: any[] = []) {
  const byId = new Map<string, any>();
  const byName = new Map<string, any[]>();
  const allParties: { id: string; nameKey: string; party: any }[] = [];

  for (const p of parties) {
    if (!p) continue;
    const id = String(p.id || "").trim();
    if (id) {
      byId.set(id, p);
    }
    const nameKey = normalizeNameKey(p.name);
    if (nameKey) {
      const list = byName.get(nameKey) || [];
      list.push(p);
      byName.set(nameKey, list);
    }
    if (id || nameKey) {
      allParties.push({ id, nameKey, party: p });
    }
  }

  const resolveParty = (
    rawIds: (string | null | undefined)[],
    rawNames: (string | null | undefined)[]
  ) => {
    const cleanIds = rawIds
      .map((id) => (id ? String(id).trim() : ""))
      .filter(Boolean);
    const cleanNames = rawNames
      .map((n) => (n ? String(n).trim().replace(/\s+/g, " ") : ""))
      .filter(Boolean);
    const nameKeys = cleanNames.map(normalizeNameKey).filter(Boolean);

    let matchedById: any | undefined;
    for (const cid of cleanIds) {
      if (byId.has(cid)) {
        matchedById = byId.get(cid);
        break;
      }
    }

    const matchedByNameList: any[] = [];
    for (const nk of nameKeys) {
      const exactList = byName.get(nk);
      if (exactList && exactList.length > 0) {
        matchedByNameList.push(...exactList);
      } else {
        // Fallback: check if a party name in parties contains nk or nk contains party name
        for (const entry of allParties) {
          if (
            entry.nameKey &&
            (entry.nameKey.includes(nk) || nk.includes(entry.nameKey))
          ) {
            matchedByNameList.push(entry.party);
          }
        }
      }
    }

    const primaryMatch = matchedById || matchedByNameList[0];
    const primaryName = cleanNames[0] || "";
    const primaryNameKey = nameKeys[0] || "";

    const resolvedId = primaryMatch?.id
      ? String(primaryMatch.id).trim()
      : cleanIds[0] || (primaryNameKey ? `party:${primaryNameKey}` : undefined);
    const resolvedName = primaryMatch?.name
      ? String(primaryMatch.name).trim()
      : primaryName || undefined;

    const keys = new Set<string>();
    for (const cid of cleanIds) keys.add(cid);
    if (resolvedId) keys.add(resolvedId);
    for (const m of matchedByNameList) {
      if (m?.id) keys.add(String(m.id).trim());
      const mn = normalizeNameKey(m?.name);
      if (mn) keys.add(`name:${mn}`);
    }
    for (const nk of nameKeys) {
      keys.add(`name:${nk}`);
      keys.add(`party:${nk}`);
    }
    if (resolvedName) {
      const rnk = normalizeNameKey(resolvedName);
      keys.add(`name:${rnk}`);
      keys.add(`party:${rnk}`);
    }

    return {
      resolvedId,
      resolvedName,
      rawId: cleanIds[0] || undefined,
      keys: Array.from(keys),
    };
  };

  return { byId, byName, resolveParty };
}

/**
 * Ensures every party referenced by ledger rows exists in the parties list with matching IDs/keys.
 */
export function syncPartiesWithLedgerRows(
  parties: any[] = [],
  ledgerRows: AccountStatementLedgerRow[] = []
): any[] {
  const result = [...parties];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const p of parties) {
    if (!p) continue;
    if (p.id) seenIds.add(String(p.id).trim());
    const nk = normalizeNameKey(p.name);
    if (nk) seenNames.add(nk);
  }

  for (const r of ledgerRows) {
    if (!r) continue;
    const pid = r.party_id ? String(r.party_id).trim() : "";
    const pname = r.party_name ? String(r.party_name).trim() : "";
    const nk = normalizeNameKey(pname);
    if (!pname || !nk) continue;
    if ((pid && seenIds.has(pid)) || seenNames.has(nk)) continue;

    const newId = pid || `party:${nk}`;
    seenIds.add(newId);
    seenNames.add(nk);
    result.push({
      id: newId,
      name: pname,
      type: "client",
      active: true,
      isSyntheticLedgerParty: true,
    });
  }

  return result;
}

/**
 * Normalizes an existing StatementRow / ledger row so its party keys, date, and fields
 * match the canonical AccountStatementLedgerRow shape.
 */
export function normalizeAccountStatementRow(
  r: any,
  parties: any[] = [],
  idx = 0
): AccountStatementLedgerRow {
  const { resolveParty } = createPartyLookups(parties);

  // Extract party name from row or description ("Ticket Booking - ANEES DINA")
  let inferredPartyName = r.party_name || r.client_name || "";
  const desc = String(r.description || r.particulars || "");
  if (!inferredPartyName && desc.includes(" - ")) {
    inferredPartyName = desc.split(" - ").slice(1).join(" - ").trim();
  }

  const clientParty = resolveParty(
    [r.party_id, r.raw_party_id, r.client_id],
    [inferredPartyName, r.party_name, r.client_name]
  );
  const vendorParty = resolveParty(
    [r.vendor_id, r.raw_vendor_id],
    [r.vendor_name]
  );

  const entryVal = String(r.entry || r.entry_type || "Sale");
  const descVal = desc || "—";
  const debit = Number(r.debit) || 0;
  const credit = Number(r.credit) || 0;
  const overdueDays =
    typeof r.overdue_days === "number"
      ? r.overdue_days
      : typeof r.days_overdue === "number"
      ? r.days_overdue
      : null;
  const overdueStatus =
    r.overdue_status ||
    (overdueDays && overdueDays > 0 ? `${overdueDays}d Overdue` : "Current");
  const isUnpaid =
    typeof r.is_unpaid === "boolean"
      ? r.is_unpaid
      : entryVal === "Sale" && debit - credit > 0;

  const combinedKeys = Array.from(
    new Set([...(r.party_keys || []), ...clientParty.keys, ...vendorParty.keys])
  );

  return {
    ...r,
    id: String(r.id || r.voucher_no || `row_${idx}`),
    date: toPlainYmd(r.date),
    voucher_no: String(r.voucher_no || "—"),
    description: descVal,
    particulars: descVal,
    entry: entryVal,
    entry_type: entryVal,
    service: r.service || "Ticket",
    party_id: clientParty.resolvedId || vendorParty.resolvedId,
    raw_party_id: clientParty.rawId,
    party_name: clientParty.resolvedName,
    vendor_id: vendorParty.resolvedId,
    raw_vendor_id: vendorParty.rawId,
    vendor_name: vendorParty.resolvedName,
    party_keys: combinedKeys,
    debit,
    credit,
    balance: Number(r.balance) || 0,
    overdue_days: overdueDays,
    days_overdue: overdueDays ?? undefined,
    overdue_status: overdueStatus,
    is_unpaid: isUnpaid,
    payment_status: r.payment_status,
    is_void: Boolean(r.is_void),
    search_text:
      r.search_text ||
      [r.voucher_no, descVal, clientParty.resolvedName, vendorParty.resolvedName, r.service]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
  };
}

/**
 * Single source-of-truth builder for Account Statement ledger rows.
 * Used by BOTH the Account Statement table on ReportsHub and the Export PDF dialog (Live Preview + PDF export).
 */
export function buildAccountStatementRows({
  rawInvoices = [],
  rawTransactions = [],
  rawExpenses = [],
  rawRefunds = [],
  parties = [],
  detailedView = false,
}: BuildAccountStatementParams): AccountStatementLedgerRow[] {
  const { resolveParty } = createPartyLookups(parties);

  const buildInvoiceRow = (inv: any, isDetailed: boolean): AccountStatementLedgerRow => {
    const relPartyName = extractPartyNameFromRelation(inv.party);
    const moreDetailsClientName = extractMoreDetailsClientName(inv.more_details);
    const passengerNames = extractPassengerNames(inv.passengers);
    const candidateClientNames = [
      relPartyName,
      inv.client_name,
      inv.party_name,
      moreDetailsClientName,
      ...passengerNames,
    ].filter(Boolean);

    const candidatePartyIds = [
      inv.party_id,
      inv.client_id,
      inv._isLegacyClientFallback ? inv.id : undefined,
    ];
    const clientParty = resolveParty(candidatePartyIds, candidateClientNames);

    const relVendorName = extractPartyNameFromRelation(inv.vendor);
    const candidateVendorNames = [relVendorName, inv.vendor_name].filter(Boolean);
    const vendorParty = resolveParty([inv.vendor_id], candidateVendorNames);

    const service = inv.service || "Ticket";
    const displayPartyName =
      clientParty.resolvedName || candidateClientNames[0] || "";
    const description = `${service} Booking - ${displayPartyName}`;
    const voucherNo =
      inv.invoice_no ||
      inv.invoice_number ||
      `INV-${String(inv.id || "").slice(0, 4).toUpperCase()}`;

    const clientAmount = Number(inv.client_amount) || 0;
    const paidAmount = Number(inv.paid_amount) || 0;
    const debit = clientAmount;
    const credit = isDetailed ? 0 : paidAmount;

    const overdueDays = getOverdueDaysForInvoice(inv);
    const overdueStatus =
      overdueDays && overdueDays > 0 ? `${overdueDays}d Overdue` : "Current";

    const voided = isInvoiceVoidedOrRefunded(inv);
    const rawStatus = String(inv.payment_status || "").trim().toLowerCase();
    const isUnpaid = !voided && rawStatus !== "paid" && clientAmount - paidAmount > 0;

    const partyKeys = Array.from(new Set([...clientParty.keys, ...vendorParty.keys]));

    return {
      id: isDetailed ? `inv_${inv.id}` : String(inv.id),
      date: toPlainYmd(inv.invoice_date || inv.date || inv.flight_date || inv.created_at),
      voucher_no: voucherNo,
      description,
      particulars: description,
      service,
      entry: "Sale",
      entry_type: "Sale",
      party_id: clientParty.resolvedId || vendorParty.resolvedId,
      raw_party_id: clientParty.rawId,
      party_name: displayPartyName || undefined,
      vendor_id: vendorParty.resolvedId,
      raw_vendor_id: vendorParty.rawId,
      vendor_name: vendorParty.resolvedName || candidateVendorNames[0] || undefined,
      party_keys: partyKeys,
      debit,
      credit,
      balance: 0,
      overdue_days: overdueDays,
      days_overdue: overdueDays ?? undefined,
      overdue_status: overdueStatus,
      is_unpaid: isUnpaid,
      payment_status: rawStatus || (isUnpaid ? "unpaid" : "paid"),
      is_void: voided,
      search_text: [
        voucherNo,
        inv.pnr,
        inv.ticket_no,
        displayPartyName,
        ...candidateClientNames,
        vendorParty.resolvedName,
        description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  };

  if (!detailedView) {
    return rawInvoices.map((inv) => buildInvoiceRow(inv, false));
  }

  const invEntries = rawInvoices.map((inv) => buildInvoiceRow(inv, true));

  const txEntries: AccountStatementLedgerRow[] = (rawTransactions || [])
    .filter((t: any) => !t.is_void)
    .map((t: any) => {
      const isReceipt = t.type === "payment_in";
      const isExp = t.type === "expense";
      const isRef = t.type === "refund";

      let entryType = "Payment";
      if (isExp) entryType = "Expense";
      else if (isRef) entryType = "Refund";
      else if (t.type === "void") entryType = "Void";
      else if (t.type === "transfer") entryType = "Transfer";

      let debitVal = 0;
      let creditVal = 0;
      if (isReceipt) {
        creditVal = Number(t.debit) || Number(t.amount) || 0;
      } else {
        debitVal = Number(t.credit) || Number(t.amount) || 0;
      }

      const txParty = resolveParty(
        [t.party_id],
        [t.party_name, extractPartyNameFromRelation(t.party)]
      );
      const voucherNo =
        t.reference_no || `PV-${String(t.id || "").slice(0, 4).toUpperCase()}`;
      const description = t.notes || t.category || `${entryType} Voucher`;

      return {
        id: `tx_${t.id}`,
        date: toPlainYmd(t.date || t.created_at),
        voucher_no: voucherNo,
        description,
        particulars: description,
        service: "Other",
        entry: entryType,
        entry_type: entryType,
        party_id: txParty.resolvedId,
        raw_party_id: txParty.rawId,
        party_name: txParty.resolvedName,
        party_keys: txParty.keys,
        debit: debitVal,
        credit: creditVal,
        balance: 0,
        overdue_days: null,
        overdue_status: "Current",
        is_unpaid: false,
        is_void: Boolean(t.is_void),
        search_text: [voucherNo, t.notes, t.category, txParty.resolvedName, description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase(),
      };
    });

  const expEntries: AccountStatementLedgerRow[] = (rawExpenses || []).map((e: any) => {
    const voucherNo =
      e.reference_number || `EXP-${String(e.id || "").slice(0, 4).toUpperCase()}`;
    const description = `Expense: ${e.expense_type || e.notes || "Operating Expense"}`;
    return {
      id: `exp_${e.id}`,
      date: toPlainYmd(e.expense_date || e.created_at),
      voucher_no: voucherNo,
      description,
      particulars: description,
      service: "Other",
      entry: "Expense",
      entry_type: "Expense",
      party_keys: [],
      debit: Number(e.amount) || 0,
      credit: 0,
      balance: 0,
      overdue_days: null,
      overdue_status: "Current",
      is_unpaid: false,
      is_void: false,
      search_text: [voucherNo, e.expense_type, e.notes, description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  const refEntries: AccountStatementLedgerRow[] = (rawRefunds || []).map((r: any) => {
    const refParty = resolveParty(
      [r.party_id, r.client_id],
      [r.party_name, r.client_name]
    );
    const voucherNo =
      r.refund_no || `REF-${String(r.id || "").slice(0, 4).toUpperCase()}`;
    const description = `Refund: ${r.reason || "Ticket Refund"}`;
    return {
      id: `ref_${r.id}`,
      date: toPlainYmd(r.refund_date || r.created_at),
      voucher_no: voucherNo,
      description,
      particulars: description,
      service: "Ticket",
      entry: "Refund",
      entry_type: "Refund",
      party_id: refParty.resolvedId,
      raw_party_id: refParty.rawId,
      party_name: refParty.resolvedName,
      party_keys: refParty.keys,
      debit: 0,
      credit: Number(r.client_refund_amount ?? r.refund_amount ?? r.amount) || 0,
      balance: 0,
      overdue_days: null,
      overdue_status: "Current",
      is_unpaid: false,
      is_void: false,
      search_text: [voucherNo, r.reason, refParty.resolvedName, description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase(),
    };
  });

  return [...invEntries, ...txEntries, ...expEntries, ...refEntries];
}

function rowMatchesPartySet(
  row: AccountStatementLedgerRow,
  idSet: Set<string>,
  nameSet: Set<string>
): boolean {
  if (row.party_id && idSet.has(String(row.party_id).trim())) return true;
  if (row.raw_party_id && idSet.has(String(row.raw_party_id).trim())) return true;
  if (row.vendor_id && idSet.has(String(row.vendor_id).trim())) return true;
  if (row.raw_vendor_id && idSet.has(String(row.raw_vendor_id).trim())) return true;

  if (row.party_keys && row.party_keys.length > 0) {
    for (const k of row.party_keys) {
      if (idSet.has(k)) return true;
      if (k.startsWith("name:") && nameSet.has(k.slice(5))) return true;
      if (k.startsWith("party:") && nameSet.has(k.slice(6))) return true;
    }
  }

  const rPartyName = normalizeNameKey(row.party_name);
  if (rPartyName) {
    if (nameSet.has(rPartyName)) return true;
    for (const n of nameSet) {
      if (n && (rPartyName.includes(n) || n.includes(rPartyName))) return true;
    }
  }

  const rVendorName = normalizeNameKey(row.vendor_name);
  if (rVendorName) {
    if (nameSet.has(rVendorName)) return true;
    for (const n of nameSet) {
      if (n && (rVendorName.includes(n) || n.includes(rVendorName))) return true;
    }
  }

  const descLower = normalizeNameKey(row.description || row.particulars);
  if (descLower && nameSet.size > 0) {
    for (const name of nameSet) {
      if (name && descLower.includes(name)) return true;
    }
  }

  return false;
}

/**
 * Checks whether a ledger row matches the selected parties in the page filter or Export PDF dialog.
 * Handles party IDs, legacy client/vendor IDs, case-insensitive party names, and unlinked/walk-in rows.
 */
export function doesRowMatchSelectedParties(
  row: AccountStatementLedgerRow,
  selectedPartyIds: string[] = [],
  parties: any[] = []
): boolean {
  const activeIds = (selectedPartyIds || [])
    .map((id) => String(id || "").trim())
    .filter((id) => id.length > 0 && id !== "all");

  // Empty selection means "All Parties"
  if (activeIds.length === 0) return true;

  const selectedIdSet = new Set(activeIds);

  // Build sets for real parties (from parties table) and all parties (including synthetic ledger parties)
  const realPartyIdSet = new Set<string>();
  const realPartyNameSet = new Set<string>();
  const realClientPartyIds: string[] = [];
  const selectedNameSet = new Set<string>();

  for (const p of parties) {
    if (!p) continue;
    const pid = String(p.id || "").trim();
    const pname = normalizeNameKey(p.name);
    const isSynthetic = Boolean(p.isSyntheticLedgerParty);

    if (!isSynthetic) {
      if (pid) realPartyIdSet.add(pid);
      if (pname) realPartyNameSet.add(pname);

      const pType = String(p.type || "client").trim().toLowerCase();
      if (pid && (pType === "client" || pType === "both" || pType !== "vendor")) {
        realClientPartyIds.push(pid);
      }
    }

    if (pid && selectedIdSet.has(pid)) {
      if (pname) selectedNameSet.add(pname);
    }
  }

  // Also support synthetic "party:<name>" IDs directly in selectedPartyIds
  for (const sid of activeIds) {
    if (sid.startsWith("party:")) {
      selectedNameSet.add(sid.slice(6));
    }
  }

  // 1. If all real parties in the agency are selected, include all rows
  if (
    realPartyIdSet.size > 0 &&
    Array.from(realPartyIdSet).every((pid) => selectedIdSet.has(pid))
  ) {
    return true;
  }

  // 2. If all real client parties are selected and this is a Sale/Client ledger row, include it
  if (
    realClientPartyIds.length > 0 &&
    realClientPartyIds.every((cid) => selectedIdSet.has(cid)) &&
    (row.entry === "Sale" || row.entry_type === "Sale" || row.entry === "Refund")
  ) {
    return true;
  }

  // 3. Direct match against selected party IDs or names
  if (rowMatchesPartySet(row, selectedIdSet, selectedNameSet)) {
    return true;
  }

  // 4. If this ledger row does not match ANY real party in the `parties` table (e.g. walk-in
  //    passenger or unlinked booking invoice whose party is not in `parties`), include it
  if (!rowMatchesPartySet(row, realPartyIdSet, realPartyNameSet)) {
    return true;
  }

  return false;
}

/**
 * Single shared filter function for Account Statement table, Live Preview, and PDF Export.
 */
export function filterAccountStatementRows(
  sourceRows: (AccountStatementLedgerRow | StatementRow)[],
  criteria: AccountStatementFilterCriteria,
  parties: any[] = []
): AccountStatementLedgerRow[] {
  const normalizedRows: AccountStatementLedgerRow[] = (sourceRows || []).map((r, i) =>
    "party_keys" in r && Array.isArray((r as AccountStatementLedgerRow).party_keys)
      ? (r as AccountStatementLedgerRow)
      : normalizeAccountStatementRow(r, parties, i)
  );

  const effectiveParties = syncPartiesWithLedgerRows(parties, normalizedRows);

  const statusFilter = String(criteria.status || "all").trim().toLowerCase();
  const overdueBucket = String(criteria.overdueBucket || "none").trim();
  const onlyUnpaid = Boolean(criteria.onlyUnpaid);
  const searchQuery = String(criteria.searchQuery || "").trim().toLowerCase();
  const fromDate = toPlainYmd(criteria.fromDate);
  const toDate = toPlainYmd(criteria.toDate);
  const datePreset = criteria.datePreset || "this_month";
  const selectedPartyIds = criteria.selectedPartyIds || [];

  const filtered = normalizedRows.filter((r) => {
    // 1. Exclude voided/refunded invoices unless explicitly filtering for them
    if (statusFilter !== "void" && statusFilter !== "refunded" && r.is_void) {
      return false;
    }

    // 2. Compare dates as plain YYYY-MM-DD strings (no timezone conversion)
    if (!isPlainYmdInRange(r.date, fromDate, toDate, datePreset)) {
      return false;
    }

    // 3. Party filter (matches resolved party IDs, raw IDs, party names, and walk-in rows)
    if (!doesRowMatchSelectedParties(r, selectedPartyIds, effectiveParties)) {
      return false;
    }

    // 4. Payment status filter
    if (
      statusFilter !== "all" &&
      (r.entry === "Sale" || r.entry_type === "Sale") &&
      r.payment_status &&
      r.payment_status !== statusFilter
    ) {
      return false;
    }

    // 5. Only Unpaid Invoices toggle
    if (onlyUnpaid && !r.is_unpaid) {
      return false;
    }

    // 6. Overdue Bucket filter ("none" = All Records -> includes fully paid records with running balance 0)
    if (overdueBucket && overdueBucket !== "none" && overdueBucket !== "all_records") {
      const days = r.overdue_days ?? r.days_overdue ?? null;
      if (!days || days <= 0) return false;
      if (overdueBucket === "all" && !(days > 0)) return false;
      if (overdueBucket === "0-30" && !(days > 0 && days <= 30)) return false;
      if (overdueBucket === "31-60" && !(days > 30 && days <= 60)) return false;
      if (overdueBucket === "61-90" && !(days > 60 && days <= 90)) return false;
      if (overdueBucket === "90+" && !(days > 90)) return false;
    }

    // 7. Search query
    if (searchQuery) {
      const haystack =
        r.search_text ||
        `${r.voucher_no || ""} ${r.description || ""} ${r.party_name || ""}`.toLowerCase();
      if (!haystack.includes(searchQuery)) return false;
    }

    return true;
  });

  // Sort chronologically by plain YYYY-MM-DD date string
  filtered.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // Calculate live running balance
  let running = 0;
  const result = filtered.map((r) => {
    const debit = Number(r.debit) || 0;
    const credit = Number(r.credit) || 0;
    running = running + debit - credit;
    return {
      ...r,
      debit,
      credit,
      balance: running,
    };
  });

  const totalDebit = result.reduce((sum, r) => sum + (Number(r.debit) || 0), 0);
  const totalCredit = result.reduce((sum, r) => sum + (Number(r.credit) || 0), 0);

  console.log("[AccountStatementFilter]", {
    filterInputs: {
      datePreset,
      fromDate,
      toDate,
      selectedPartyIds,
      onlyUnpaid,
      overdueBucket,
      detailedView: Boolean(criteria.detailedView),
      status: statusFilter,
      searchQuery,
    },
    sourceCount: normalizedRows.length,
    resultCount: result.length,
    totalDebit,
    totalCredit,
  });

  return result;
}
