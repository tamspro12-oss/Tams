import { getKarachiYmd } from "@/lib/karachiTime";
import {
  createDefaultPassenger,
  createDefaultServiceDetails,
  normalizeServiceType,
  type Passenger,
  type ServiceDetailsState,
  type ServiceType,
  type TripType,
} from "@/lib/serviceDefinitions";

export type EditableDocumentType = "booking_invoice" | "payment_voucher" | "refund";

export interface DocumentEditHistoryEntry {
  id: string;
  agency_id: string;
  document_type: EditableDocumentType;
  document_id: string;
  document_no: string | null;
  edited_by: string | null;
  edited_by_name: string | null;
  edited_at: string;
  reason: string;
  old_values: Record<string, any>;
  new_values: Record<string, any>;
  changed_fields: string[];
  affected_ledger: boolean;
  reversal_group_id: string | null;
  created_at: string;
}

export interface EditPermissionInput {
  isSubUser: boolean;
  isActive?: boolean;
  permissions?: unknown;
  isLoading?: boolean;
}

function moduleAllowsWrite(perms: Record<string, any>, moduleName: string): boolean {
  const val = perms[moduleName];
  if (typeof val === "boolean") return val;
  if (val && typeof val === "object" && !Array.isArray(val)) {
    return val.write === true;
  }
  return false;
}

/**
 * Mirrors server-side assert_module_permission() checks for editing Sales & Expenses records.
 */
export function canEditSalesDocument(
  perm: EditPermissionInput | null | undefined,
  docType: EditableDocumentType
): boolean {
  if (!perm) return true;
  if (perm.isLoading) return false;
  if (!perm.isSubUser) return true;
  if (perm.isActive === false) return false;
  if (!perm.permissions || typeof perm.permissions !== "object" || Array.isArray(perm.permissions)) {
    return false;
  }

  const perms = perm.permissions as Record<string, any>;
  if (docType === "booking_invoice") {
    return moduleAllowsWrite(perms, "bookings") || moduleAllowsWrite(perms, "invoices");
  }
  if (docType === "payment_voucher") {
    return (
      moduleAllowsWrite(perms, "payments") ||
      moduleAllowsWrite(perms, "bookings") ||
      moduleAllowsWrite(perms, "invoices") ||
      moduleAllowsWrite(perms, "clients") ||
      moduleAllowsWrite(perms, "vendors")
    );
  }
  return (
    moduleAllowsWrite(perms, "bookings") ||
    moduleAllowsWrite(perms, "invoices") ||
    moduleAllowsWrite(perms, "clients")
  );
}

// -----------------------------------------------------------------------------
// Invoice Edit Hydration & Diff Evaluation
// -----------------------------------------------------------------------------

export interface InvoiceEditSnapshot {
  clientAmount: number;
  vendorPayable: number;
  dueDate: string;
  pnr: string;
  ticketNo: string;
  passportNo: string;
  passengersJson: string;
  serviceDetailsJson: string;
  notes: string;
}

export interface HydratedInvoiceEditState {
  service: ServiceType;
  serviceDetails: ServiceDetailsState;
  passengers: Passenger[];
  totalAmount: string;
  vendorPayable: string;
  dueDate: string;
  notes: string;
  initialSnapshot: InvoiceEditSnapshot;
}

function parseInvoiceRemarksFromNotes(rawNotes?: string | null): string {
  if (!rawNotes) return "";
  const lines = String(rawNotes).split("\n");
  const remarksIdx = lines.findIndex((line) => line.startsWith("Remarks:"));
  if (remarksIdx !== -1) {
    return lines
      .slice(remarksIdx)
      .join("\n")
      .replace(/^Remarks:\s*/, "")
      .trim();
  }
  const hasAutoSummary = lines.some((l) => /^\[(Air Ticket|Umrah Package|Visa|Hotel|Insurance|Other Service)/i.test(l.trim()));
  return hasAutoSummary ? "" : rawNotes.trim();
}

function normalizePassengersForCompare(passengers: Passenger[]): Passenger[] {
  return (passengers || [])
    .map((p) => ({
      name: (p.name || "").trim(),
      passport: (p.passport || "").trim(),
      ticketNo: (p.ticketNo || "").trim() || undefined,
      type: p.type || "Adult",
      gender: p.gender || "Male",
      dob: (p.dob || "").trim(),
      nationality: (p.nationality || "Pakistani").trim(),
    }))
    .filter((p, idx, arr) => arr.length === 1 || Boolean(p.name || p.passport || p.dob));
}

export function serializeServiceDetailsForCompare(details: ServiceDetailsState): string {
  return JSON.stringify({
    ...details,
    origin: (details.origin || "").trim().toUpperCase(),
    destination: (details.destination || "").trim().toUpperCase(),
    airline: (details.airline || "").trim(),
    pnr: (details.pnr || "").trim().toUpperCase(),
    ticketNo: (details.ticketNo || "").trim(),
    flightDate: details.flightDate || "",
    flightTime: details.flightTime || "",
    returnDate: details.returnDate || "",
    returnTime: details.returnTime || "",
    multicityLegs: (details.multicityLegs || []).map((l) => ({
      from: (l.from || "").trim().toUpperCase(),
      to: (l.to || "").trim().toUpperCase(),
      date: l.date || "",
      time: l.time || "",
      airline: (l.airline || "").trim(),
      pnr: (l.pnr || "").trim().toUpperCase(),
    })),
    umrahDepartureCity: (details.umrahDepartureCity || "").trim(),
    umrahArrivalCity: (details.umrahArrivalCity || "").trim(),
    umrahAirline: (details.umrahAirline || "").trim(),
    makkahHotel: (details.makkahHotel || "").trim(),
    madinahHotel: (details.madinahHotel || "").trim(),
    visaCountry: (details.visaCountry || "").trim(),
    visaType: (details.visaType || "").trim(),
    visaValidity: (details.visaValidity || "").trim(),
    insurancePlan: (details.insurancePlan || "").trim(),
    insuranceDuration: (details.insuranceDuration || "").trim(),
    hotelName: (details.hotelName || "").trim(),
    hotelCity: (details.hotelCity || "").trim(),
    hotelRoomType: (details.hotelRoomType || "").trim(),
    generalDescription: (details.generalDescription || "").trim(),
  });
}

export function hydrateInvoiceForEdit(inv: any): HydratedInvoiceEditState {
  const service = normalizeServiceType(inv?.service);
  const md = inv?.more_details && typeof inv.more_details === "object" ? inv.more_details : {};
  const defaults = createDefaultServiceDetails(inv?.invoice_date || undefined);

  // Extract flight info fallback from legacy bracketed summary line if present
  const notesText = String(inv?.notes || "");
  const ticketMatch = notesText.match(
    /\[Air Ticket - ([^\]]+)\]\s*([A-Z]{2,5})->([A-Z]{2,5})\s*\|\s*Date:\s*([0-9-]*)\s*([0-9:]*)/i
  );

  const serviceDetails: ServiceDetailsState = {
    ...defaults,
    tripType: (md.trip_type || ticketMatch?.[1] || defaults.tripType) as TripType,
    origin: String(md.origin || ticketMatch?.[2] || defaults.origin || ""),
    destination: String(md.destination || ticketMatch?.[3] || defaults.destination || ""),
    flightDate: String(md.flight_date || ticketMatch?.[4] || defaults.flightDate || ""),
    flightTime: String(md.flight_time || ticketMatch?.[5] || defaults.flightTime || ""),
    airline: String(md.airline || ""),
    pnr: String(inv?.pnr || md.pnr || ""),
    ticketNo: String(inv?.ticket_no || md.ticket_no || ""),
    returnDate: String(md.return_date || ""),
    returnTime: String(md.return_time || ""),
    multicityLegs: Array.isArray(md.multicity_legs) && md.multicity_legs.length > 0
      ? md.multicity_legs
      : defaults.multicityLegs,
    ziyaratIncluded: md.ziyarat_included ?? defaults.ziyaratIncluded,
    umrahDepartureCity: String(md.umrah_departure_city || defaults.umrahDepartureCity),
    umrahArrivalCity: String(md.umrah_arrival_city || defaults.umrahArrivalCity),
    umrahAirline: String(md.umrah_airline || defaults.umrahAirline),
    umrahFlightDate: String(md.umrah_flight_date || defaults.umrahFlightDate),
    umrahFlightTime: String(md.umrah_flight_time || defaults.umrahFlightTime),
    umrahReturnDate: String(md.umrah_return_date || ""),
    umrahReturnTime: String(md.umrah_return_time || ""),
    umrahTransport: String(md.umrah_transport || defaults.umrahTransport),
    makkahHotel: String(md.makkah_hotel || ""),
    makkahNights: String(md.makkah_nights ?? defaults.makkahNights),
    madinahHotel: String(md.madinah_hotel || ""),
    madinahNights: String(md.madinah_nights ?? defaults.madinahNights),
    visaCountry: String(md.visa_country || md.country || defaults.visaCountry),
    visaType: String(md.visa_type || defaults.visaType),
    visaValidity: String(md.visa_validity || defaults.visaValidity),
    insurancePlan: String(md.insurance_plan || defaults.insurancePlan),
    insuranceDuration: String(md.insurance_duration ?? defaults.insuranceDuration),
    hotelName: String(md.hotel_name || ""),
    hotelCity: String(md.hotel_city || md.city || ""),
    hotelCheckIn: String(md.hotel_check_in || defaults.hotelCheckIn),
    hotelCheckOut: String(md.hotel_check_out || ""),
    hotelRoomType: String(md.hotel_room_type || defaults.hotelRoomType),
    generalDescription: String(md.general_description || ""),
  };

  const rawPassengers = Array.isArray(inv?.passengers) && inv.passengers.length > 0
    ? inv.passengers
    : [createDefaultPassenger()];
  const passengers: Passenger[] = rawPassengers.map((p: any) => ({
    name: String(p?.name || ""),
    passport: String(p?.passport || ""),
    ticketNo: p?.ticketNo ? String(p.ticketNo) : undefined,
    type: p?.type || "Adult",
    gender: p?.gender || "Male",
    dob: String(p?.dob || ""),
    nationality: String(p?.nationality || "Pakistani"),
  }));

  const clientAmount = Number(inv?.client_amount) || 0;
  const vendorPayable = Number(inv?.vendor_payable) || 0;
  const dueDate = String(
    inv?.due_date ||
      md.remaining_due_date ||
      md.due_date ||
      inv?.invoice_date ||
      getKarachiYmd()
  ).slice(0, 10);
  const notes = parseInvoiceRemarksFromNotes(inv?.notes);

  const initialSnapshot: InvoiceEditSnapshot = {
    clientAmount,
    vendorPayable,
    dueDate,
    pnr: serviceDetails.pnr.trim(),
    ticketNo: serviceDetails.ticketNo.trim(),
    passportNo: (passengers[0]?.passport || inv?.passport_no || "").trim(),
    passengersJson: JSON.stringify(normalizePassengersForCompare(passengers)),
    serviceDetailsJson: serializeServiceDetailsForCompare(serviceDetails),
    notes: notes.trim(),
  };

  return {
    service,
    serviceDetails,
    passengers,
    totalAmount: String(clientAmount),
    vendorPayable: String(vendorPayable),
    dueDate,
    notes,
    initialSnapshot,
  };
}

export function evaluateInvoiceEdit(
  initial: InvoiceEditSnapshot,
  draft: {
    clientAmount: number;
    vendorPayable: number;
    dueDate: string;
    serviceDetails: ServiceDetailsState;
    passengers: Passenger[];
    notes: string;
  },
  existingPaidAmount: number,
  editReason: string
): {
  ok: boolean;
  error?: string;
  noChanges: boolean;
  affectsLedger: boolean;
  changedFields: string[];
} {
  const changedFields: string[] = [];
  const nextPnr = (draft.serviceDetails.pnr || "").trim();
  const nextTicket = (draft.serviceDetails.ticketNo || "").trim();
  const nextPassport = (draft.passengers[0]?.passport || "").trim();
  const nextPassengersJson = JSON.stringify(normalizePassengersForCompare(draft.passengers));
  const nextDetailsJson = serializeServiceDetailsForCompare(draft.serviceDetails);
  const nextNotes = (draft.notes || "").trim();
  const nextDueDate = (draft.dueDate || "").trim();

  if (draft.clientAmount !== initial.clientAmount) changedFields.push("client_amount");
  if (draft.vendorPayable !== initial.vendorPayable) changedFields.push("vendor_payable");
  if (nextDueDate !== initial.dueDate) changedFields.push("due_date");
  if (nextPnr !== initial.pnr) changedFields.push("pnr");
  if (nextTicket !== initial.ticketNo) changedFields.push("ticket_no");
  if (nextPassport !== initial.passportNo) changedFields.push("passport_no");
  if (nextPassengersJson !== initial.passengersJson) changedFields.push("passengers");
  if (nextDetailsJson !== initial.serviceDetailsJson) changedFields.push("more_details");
  if (nextNotes !== initial.notes) changedFields.push("notes");

  if (changedFields.length === 0) {
    return {
      ok: true,
      noChanges: true,
      affectsLedger: false,
      changedFields: [],
    };
  }

  if (!editReason.trim()) {
    return {
      ok: false,
      error: "Please enter a reason for this edit.",
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  if (!Number.isFinite(draft.clientAmount) || draft.clientAmount <= 0) {
    return {
      ok: false,
      error: "Total amount must be greater than zero.",
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  if (!Number.isFinite(draft.vendorPayable) || draft.vendorPayable < 0) {
    return {
      ok: false,
      error: "Purchasing cost cannot be negative.",
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  if (draft.clientAmount < existingPaidAmount) {
    return {
      ok: false,
      error: `Total amount (PKR ${draft.clientAmount.toLocaleString()}) cannot be less than the amount already paid (PKR ${existingPaidAmount.toLocaleString()}).`,
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  return {
    ok: true,
    noChanges: false,
    affectsLedger:
      draft.clientAmount !== initial.clientAmount || draft.vendorPayable !== initial.vendorPayable,
    changedFields,
  };
}

// -----------------------------------------------------------------------------
// Voucher Edit Hydration & Diff Evaluation
// -----------------------------------------------------------------------------

export type VoucherEditMode = "cash" | "bank" | "transfer";

export interface VoucherEditSnapshot {
  amount: number;
  paymentMode: VoucherEditMode;
  selectedBank: string;
  referenceNo: string;
  notes: string;
}

export function normalizeVoucherModeForEdit(rawMode?: string | null): VoucherEditMode {
  const m = String(rawMode || "cash").trim().toLowerCase();
  if (m === "cash") return "cash";
  if (m === "transfer") return "transfer";
  return "bank";
}

export function hydrateVoucherForEdit(
  v: any,
  accounts: Array<{ id: string; type: string; name: string }> = []
): {
  amount: string;
  paymentMode: VoucherEditMode;
  selectedBank: string;
  referenceNo: string;
  notes: string;
  initialSnapshot: VoucherEditSnapshot;
} {
  const amountNum = Number(v?.amount) || 0;
  const paymentMode = normalizeVoucherModeForEdit(v?.payment_mode);
  const matchedAccount = v?.account_id
    ? accounts.find((a) => a.id === v.account_id && a.type === "bank")
    : undefined;
  const selectedBank =
    paymentMode === "cash" ? "" : String(v?.bank_name || matchedAccount?.name || "");
  const referenceNo = String(v?.reference_no || "");
  const notes = String(v?.notes || "");

  return {
    amount: String(amountNum),
    paymentMode,
    selectedBank,
    referenceNo,
    notes,
    initialSnapshot: {
      amount: amountNum,
      paymentMode,
      selectedBank: selectedBank.trim(),
      referenceNo: referenceNo.trim(),
      notes: notes.trim(),
    },
  };
}

export function evaluateVoucherEdit(
  initial: VoucherEditSnapshot,
  draft: {
    amount: number;
    paymentMode: VoucherEditMode;
    selectedBank: string;
    referenceNo: string;
    notes: string;
  },
  editReason: string,
  isAdjustment = false
): {
  ok: boolean;
  error?: string;
  noChanges: boolean;
  affectsLedger: boolean;
  changedFields: string[];
} {
  const nextBank = draft.paymentMode === "cash" ? "" : (draft.selectedBank || "").trim();
  const nextRef = (draft.referenceNo || "").trim();
  const nextNotes = (draft.notes || "").trim();
  const changedFields: string[] = [];

  if (draft.amount !== initial.amount) changedFields.push("amount");
  if (draft.paymentMode !== initial.paymentMode) changedFields.push("payment_mode");
  if (nextBank !== initial.selectedBank) changedFields.push("bank_name");
  if (nextRef !== initial.referenceNo) changedFields.push("reference_no");
  if (nextNotes !== initial.notes) changedFields.push("notes");

  if (changedFields.length === 0) {
    return {
      ok: true,
      noChanges: true,
      affectsLedger: false,
      changedFields: [],
    };
  }

  if (!editReason.trim()) {
    return {
      ok: false,
      error: "Please enter a reason for this edit.",
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
    return {
      ok: false,
      error: "Amount must be greater than zero.",
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  if (!isAdjustment && draft.paymentMode !== "cash" && !nextBank) {
    return {
      ok: false,
      error: "Please select an agency bank account.",
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  return {
    ok: true,
    noChanges: false,
    affectsLedger:
      draft.amount !== initial.amount ||
      draft.paymentMode !== initial.paymentMode ||
      nextBank !== initial.selectedBank,
    changedFields,
  };
}

// -----------------------------------------------------------------------------
// Refund / Void Edit Hydration & Diff Evaluation
// -----------------------------------------------------------------------------

export interface RefundEditSnapshot {
  clientRefundAmount: number;
  vendorRefundAmount: number;
  deductionsAmount: number;
  reason: string;
  notes: string;
}

function splitRefundNotes(rawNotes?: string | null): {
  editableNotes: string;
  preservedMetaTokens: string[];
} {
  if (!rawNotes) return { editableNotes: "", preservedMetaTokens: [] };
  const parts = String(rawNotes)
    .split(" | ")
    .map((p) => p.trim())
    .filter(Boolean);
  const preserved: string[] = [];
  const editable: string[] = [];

  for (const part of parts) {
    if (
      /^(Bank:|Service Charges\/Deductions:|Track as pending vendor refund:|Ref Invoice:|Party:)/i.test(
        part
      )
    ) {
      if (/^(Bank:|Track as pending vendor refund:|Ref Invoice:|Party:)/i.test(part)) {
        preserved.push(part);
      }
    } else {
      editable.push(part);
    }
  }

  return {
    editableNotes: editable.join(" | "),
    preservedMetaTokens: preserved,
  };
}

export function buildEditedRefundNotes(
  editableNotes: string,
  deductions: number,
  preservedMetaTokens: string[]
): string | null {
  const parts = [
    editableNotes.trim() || null,
    deductions > 0 ? `Service Charges/Deductions: PKR ${deductions}` : null,
    ...preservedMetaTokens,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" | ") : null;
}

export function hydrateRefundForEdit(r: any): {
  actionType: "refund" | "void";
  clientRefundAmount: string;
  vendorRefundAmount: string;
  deductionsAmount: string;
  reason: string;
  notes: string;
  preservedMetaTokens: string[];
  initialSnapshot: RefundEditSnapshot;
} {
  const actionType: "refund" | "void" =
    String(r?.refund_type || "").toLowerCase() === "void" ? "void" : "refund";
  const clientRefund = Number(r?.client_refund_amount ?? r?.refund_amount ?? 0) || 0;
  const vendorRefund = Number(r?.vendor_refund_amount ?? 0) || 0;
  const deductions = Number(r?.deductions ?? 0) || 0;
  const reason = String(r?.reason || "");
  const { editableNotes, preservedMetaTokens } = splitRefundNotes(r?.notes);

  return {
    actionType,
    clientRefundAmount: String(clientRefund),
    vendorRefundAmount: String(vendorRefund),
    deductionsAmount: String(deductions),
    reason,
    notes: editableNotes,
    preservedMetaTokens,
    initialSnapshot: {
      clientRefundAmount: clientRefund,
      vendorRefundAmount: vendorRefund,
      deductionsAmount: deductions,
      reason: reason.trim(),
      notes: editableNotes.trim(),
    },
  };
}

export function evaluateRefundEdit(
  initial: RefundEditSnapshot,
  draft: {
    clientRefundAmount: number;
    vendorRefundAmount: number;
    deductionsAmount: number;
    reason: string;
    notes: string;
  },
  actionType: "refund" | "void",
  editReason: string
): {
  ok: boolean;
  error?: string;
  noChanges: boolean;
  affectsLedger: boolean;
  changedFields: string[];
} {
  const nextReason = (draft.reason || "").trim();
  const nextNotes = (draft.notes || "").trim();
  const changedFields: string[] = [];

  if (draft.clientRefundAmount !== initial.clientRefundAmount) changedFields.push("refund_amount");
  if (draft.vendorRefundAmount !== initial.vendorRefundAmount) {
    changedFields.push("vendor_refund_amount");
  }
  if (draft.deductionsAmount !== initial.deductionsAmount) changedFields.push("deductions");
  if (nextReason !== initial.reason) changedFields.push("reason");
  if (nextNotes !== initial.notes) changedFields.push("notes");

  if (changedFields.length === 0) {
    return {
      ok: true,
      noChanges: true,
      affectsLedger: false,
      changedFields: [],
    };
  }

  if (!editReason.trim()) {
    return {
      ok: false,
      error: "Please enter a reason for this edit.",
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  if (!nextReason) {
    return {
      ok: false,
      error: `Please provide a ${actionType === "void" ? "void" : "refund"} reason.`,
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  if (
    !Number.isFinite(draft.clientRefundAmount) ||
    draft.clientRefundAmount < 0 ||
    !Number.isFinite(draft.vendorRefundAmount) ||
    draft.vendorRefundAmount < 0 ||
    !Number.isFinite(draft.deductionsAmount) ||
    draft.deductionsAmount < 0
  ) {
    return {
      ok: false,
      error: "Amounts cannot be negative.",
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  if (actionType === "refund" && draft.clientRefundAmount <= 0) {
    return {
      ok: false,
      error: "Client refund amount must be greater than zero.",
      noChanges: false,
      affectsLedger: false,
      changedFields,
    };
  }

  return {
    ok: true,
    noChanges: false,
    affectsLedger:
      draft.clientRefundAmount !== initial.clientRefundAmount ||
      draft.vendorRefundAmount !== initial.vendorRefundAmount,
    changedFields,
  };
}

// -----------------------------------------------------------------------------
// Audit Formatting & PDF Note Helpers
// -----------------------------------------------------------------------------

const AUDIT_FIELD_LABELS: Record<string, string> = {
  client_amount: "Total Amount (PKR)",
  vendor_payable: "Purchasing Cost (PKR)",
  due_date: "Due Date",
  pnr: "PNR",
  ticket_no: "Ticket #",
  passport_no: "Passport #",
  passengers: "Passengers",
  more_details: "Service Details",
  notes: "Notes / Particulars",
  amount: "Amount (PKR)",
  payment_mode: "Payment Mode",
  account_id: "Account",
  account_name: "Account",
  bank_name: "Bank Account",
  reference_no: "Cheque / Reference #",
  refund_amount: "Refund Amount (PKR)",
  vendor_refund_amount: "Supplier Refund (PKR)",
  deductions: "Deductions (PKR)",
  reason: "Refund / Void Reason",
};

const MONETARY_FIELDS = new Set([
  "client_amount",
  "vendor_payable",
  "amount",
  "refund_amount",
  "vendor_refund_amount",
  "deductions",
]);

export function formatAuditFieldLabel(fieldKey: string): string {
  return AUDIT_FIELD_LABELS[fieldKey] || fieldKey.replace(/_/g, " ");
}

export function formatAuditFieldValue(fieldKey: string, value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (MONETARY_FIELDS.has(fieldKey)) {
    const num = Number(value);
    return Number.isFinite(num) ? `PKR ${num.toLocaleString()}` : String(value);
  }

  if (fieldKey === "payment_mode") {
    return String(value).toUpperCase();
  }

  if (fieldKey === "passengers" && Array.isArray(value)) {
    const names = value
      .map((p: any) => [p?.name, p?.passport].filter(Boolean).join(" / "))
      .filter(Boolean);
    return names.length > 0 ? names.join(", ") : "—";
  }

  if (fieldKey === "more_details" && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const summaryParts: string[] = [];
    if (obj.origin || obj.destination) {
      summaryParts.push(`${obj.origin || "—"}→${obj.destination || "—"}`);
    }
    if (obj.airline) summaryParts.push(String(obj.airline));
    if (obj.flight_date) summaryParts.push(`Flight: ${obj.flight_date}`);
    if (obj.hotel_name) summaryParts.push(String(obj.hotel_name));
    if (obj.visa_country) summaryParts.push(String(obj.visa_country));
    if (obj.general_description) summaryParts.push(String(obj.general_description));
    if (summaryParts.length > 0) return summaryParts.join(" · ");
    return JSON.stringify(obj);
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function formatEditedDateShort(isoDate?: string | null): string {
  if (!isoDate) return "";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return getKarachiYmd(String(isoDate)) || String(isoDate);
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function formatEditedTimestamp(isoDate?: string | null): string {
  if (!isoDate) return "—";
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return String(isoDate);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(parsed);
}

export function formatPdfEditedNote(
  isEdited?: boolean | null,
  lastEditedAt?: string | null
): string | null {
  if (!isEdited) return null;
  const formatted = formatEditedDateShort(lastEditedAt);
  return formatted ? `Edited on ${formatted}` : "Edited";
}

