export interface ValidateBookingVendorPaymentInput {
  vendorAmountPaid: number;
  purchasingCost: number;
  vendorId?: string | null;
  paymentMode: string;
  selectedBank?: string | null;
  clientAmountPaid: number;
}

export interface BookingVendorPaymentValidationResult {
  ok: boolean;
  code?: "negative" | "missing_vendor" | "exceeds_cost" | "missing_bank";
  error?: string;
}

/**
 * Parses the optional "Amount Paid to Vendor" input safely; empty or invalid values resolve to 0.
 */
export function parseVendorAmountPaid(raw: string | number | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : 0;
  }
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Validates optional vendor payout rules on New Booking Invoice without changing existing client rules.
 */
export function validateBookingVendorPayment(
  input: ValidateBookingVendorPaymentInput
): BookingVendorPaymentValidationResult {
  const {
    vendorAmountPaid,
    purchasingCost,
    vendorId,
    paymentMode,
    selectedBank,
    clientAmountPaid,
  } = input;

  if (vendorAmountPaid < 0) {
    return {
      ok: false,
      code: "negative",
      error: "Amounts cannot be negative.",
    };
  }

  const hasVendor = Boolean(vendorId && vendorId.trim() !== "" && vendorId !== "none");
  if (vendorAmountPaid > 0 && !hasVendor) {
    return {
      ok: false,
      code: "missing_vendor",
      error: "Please select a vendor before entering an amount paid to vendor.",
    };
  }

  if (vendorAmountPaid > purchasingCost) {
    return {
      ok: false,
      code: "exceeds_cost",
      error: "Amount paid to vendor cannot exceed the purchasing cost.",
    };
  }

  const hasAnyPayment = clientAmountPaid > 0 || vendorAmountPaid > 0;
  if (hasAnyPayment && paymentMode === "bank" && !String(selectedBank || "").trim()) {
    return {
      ok: false,
      code: "missing_bank",
      error: "Please select an agency bank account for bank payment.",
    };
  }

  return { ok: true };
}

/**
 * Returns true when either a client receipt or a vendor payment will post to Cash/Bank at booking.
 */
export function shouldResolveBookingPaymentAccount(
  clientAmountPaid: number,
  vendorAmountPaid: number
): boolean {
  return clientAmountPaid > 0 || vendorAmountPaid > 0;
}

/**
 * Builds canonical Reference No and Particulars for auto vendor CPV vouchers created at booking.
 */
export function buildVendorBookingVoucherMeta(invoiceNo: string): {
  referenceNo: string;
  notes: string;
} {
  const cleanNo = invoiceNo.trim();
  return {
    referenceNo: `AT-VENDOR-BOOKING-${cleanNo}`,
    notes: `Initial payment to vendor at booking for ${cleanNo}`,
  };
}
