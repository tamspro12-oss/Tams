import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  parseVendorAmountPaid,
  validateBookingVendorPayment,
  shouldResolveBookingPaymentAccount,
  buildVendorBookingVoucherMeta,
} = await import("../src/lib/bookingVendorPaymentHelpers.ts");
const { computeFinancialMetrics, resolveAccountIdForPayment } = await import(
  "../src/lib/accountingEngine.ts"
);
const { buildPartyLedger } = await import("../src/lib/partyLedger.ts");
const { parseFriendlyError } = await import("../src/lib/friendlyError.ts");

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("1. Validation helper handles empty/0, negative, missing vendor, exceeds cost, and bank mode", () => {
  assert.equal(parseVendorAmountPaid(""), 0);
  assert.equal(parseVendorAmountPaid("   "), 0);
  assert.equal(parseVendorAmountPaid("0"), 0);
  assert.equal(parseVendorAmountPaid(null), 0);
  assert.equal(parseVendorAmountPaid(undefined), 0);
  assert.equal(parseVendorAmountPaid("25000"), 25000);
  assert.equal(parseVendorAmountPaid("-10"), -10);

  // Empty / 0 vendor payment behaves identically to existing flow
  assert.deepEqual(
    validateBookingVendorPayment({
      vendorAmountPaid: 0,
      purchasingCost: 80000,
      vendorId: "",
      paymentMode: "cash",
      selectedBank: "",
      clientAmountPaid: 0,
    }),
    { ok: true }
  );

  // Negative amount blocked
  const neg = validateBookingVendorPayment({
    vendorAmountPaid: -500,
    purchasingCost: 80000,
    vendorId: "vendor-1",
    paymentMode: "cash",
    selectedBank: "",
    clientAmountPaid: 0,
  });
  assert.equal(neg.ok, false);
  assert.equal(neg.code, "negative");

  // Amount > 0 without vendor blocked
  const noVendor = validateBookingVendorPayment({
    vendorAmountPaid: 20000,
    purchasingCost: 80000,
    vendorId: "",
    paymentMode: "cash",
    selectedBank: "",
    clientAmountPaid: 0,
  });
  assert.equal(noVendor.ok, false);
  assert.equal(noVendor.code, "missing_vendor");

  const noneVendor = validateBookingVendorPayment({
    vendorAmountPaid: 20000,
    purchasingCost: 80000,
    vendorId: "none",
    paymentMode: "cash",
    selectedBank: "",
    clientAmountPaid: 0,
  });
  assert.equal(noneVendor.ok, false);
  assert.equal(noneVendor.code, "missing_vendor");

  // Amount > purchasing cost blocked
  const overCost = validateBookingVendorPayment({
    vendorAmountPaid: 90000,
    purchasingCost: 80000,
    vendorId: "vendor-1",
    paymentMode: "cash",
    selectedBank: "",
    clientAmountPaid: 0,
  });
  assert.equal(overCost.ok, false);
  assert.equal(overCost.code, "exceeds_cost");

  // Bank mode requires bank even when ONLY vendor payment > 0 (client payment = 0)
  assert.equal(shouldResolveBookingPaymentAccount(0, 30000), true);
  assert.equal(shouldResolveBookingPaymentAccount(0, 0), false);
  const missingBank = validateBookingVendorPayment({
    vendorAmountPaid: 30000,
    purchasingCost: 80000,
    vendorId: "vendor-1",
    paymentMode: "bank",
    selectedBank: "",
    clientAmountPaid: 0,
  });
  assert.equal(missingBank.ok, false);
  assert.equal(missingBank.code, "missing_bank");

  // Full purchasing cost via selected bank passes
  assert.deepEqual(
    validateBookingVendorPayment({
      vendorAmountPaid: 80000,
      purchasingCost: 80000,
      vendorId: "vendor-1",
      paymentMode: "bank",
      selectedBank: "Meezan Bank",
      clientAmountPaid: 0,
    }),
    { ok: true }
  );

  // Meta helper matches required Ref and Particulars format
  assert.deepEqual(buildVendorBookingVoucherMeta("INV-0042"), {
    referenceNo: "AT-VENDOR-BOOKING-INV-0042",
    notes: "Initial payment to vendor at booking for INV-0042",
  });
});

test("2. Accounting & Vendor Ledger integration: empty vs partial vs full vendor payment + bank mode", () => {
  const baseAccounts = [
    { id: "acc-cash", name: "Cash in Hand", type: "cash", opening_balance: 50000, active: true },
    { id: "acc-bank", name: "Meezan Bank", type: "bank", opening_balance: 200000, active: true },
  ];

  const baseInvoice = {
    id: "inv-100",
    invoice_no: "INV-0100",
    invoice_date: "2026-11-23",
    due_date: "2026-11-30",
    service: "Ticket",
    party_id: "client-1",
    vendor_id: "vendor-1",
    client_amount: 100000,
    vendor_payable: 80000,
    paid_amount: 40000,
    payment_status: "partial",
    is_void: false,
    passengers: [
      { name: "Passenger 1", passport: "PA111" },
      { name: "Passenger 2", passport: "PA222" },
      { name: "Passenger 3", passport: "PA333" },
    ],
  };

  const clientCrv = {
    id: "v-crv-1",
    voucher_no: "CRV-0001",
    voucher_date: "2026-11-23",
    direction: "received",
    payment_mode: "cash",
    account_id: "acc-cash",
    party_id: "client-1",
    amount: 40000,
    reference_no: "AT-BOOKING-INV-0100",
    notes: "Initial payment at booking for INV-0100",
    is_void: false,
  };

  // A) Empty / 0 vendor payment: identical to baseline
  const baselineMetrics = computeFinancialMetrics({
    invoices: [baseInvoice],
    vouchers: [clientCrv],
    expenses: [],
    accounts: baseAccounts,
    refunds: [],
    periodStartYmd: "2026-11-01",
    periodEndYmd: "2026-11-30",
    todayYmd: "2026-11-23",
  });
  assert.equal(baselineMetrics.clientDues, 60000);
  assert.equal(baselineMetrics.vendorDues, 80000);
  assert.equal(baselineMetrics.periodProfit, 20000);
  assert.equal(baselineMetrics.cashAndBank, 290000);

  // B) Partial vendor payment (30,000 cash): Vendor due drops 80k -> 50k, Profit stays 20k, Client due stays 60k
  const partialVendorCpv = {
    id: "v-cpv-1",
    voucher_no: "CPV-0001",
    voucher_date: "2026-11-23",
    direction: "paid",
    payment_mode: "cash",
    account_id: "acc-cash",
    party_id: "vendor-1",
    amount: 30000,
    reference_no: "AT-VENDOR-BOOKING-INV-0100",
    notes: "Initial payment to vendor at booking for INV-0100",
    is_void: false,
  };

  const partialMetrics = computeFinancialMetrics({
    invoices: [baseInvoice],
    vouchers: [clientCrv, partialVendorCpv],
    expenses: [],
    accounts: baseAccounts,
    refunds: [],
    periodStartYmd: "2026-11-01",
    periodEndYmd: "2026-11-30",
    todayYmd: "2026-11-23",
  });
  assert.equal(partialMetrics.clientDues, 60000, "Client dues unchanged by vendor payment");
  assert.equal(partialMetrics.vendorDues, 50000, "Vendor dues reduced by 30,000");
  assert.equal(partialMetrics.periodProfit, 20000, "Profit formula Total - Cost unchanged");
  assert.equal(partialMetrics.cashAndBank, 260000, "Cash & Bank reduced by 30,000");

  const vendorPartialLedger = buildPartyLedger({
    party: {
      id: "vendor-1",
      name: "PIA Consolidator",
      type: "vendor",
      opening_balance: 0,
      current_balance: -50000,
    },
    bookingInvoices: [baseInvoice],
    paymentVouchers: [partialVendorCpv],
  });
  assert.equal(vendorPartialLedger.closingBalance, -50000);
  assert.equal(vendorPartialLedger.hasMismatch, false);
  assert.equal(vendorPartialLedger.entriesOldestFirst.length, 2);
  assert.equal(vendorPartialLedger.entriesOldestFirst[1].type, "Payment (CPV)");
  assert.equal(vendorPartialLedger.entriesOldestFirst[1].debit, 30000);

  // C) Full purchasing cost paid (80,000 via Meezan Bank): Vendor due = 0, bank account selected
  assert.equal(resolveAccountIdForPayment(baseAccounts, "bank", "Meezan Bank"), "acc-bank");
  const fullVendorCpv = {
    ...partialVendorCpv,
    id: "v-cpv-2",
    payment_mode: "bank",
    account_id: "acc-bank",
    bank_name: "Meezan Bank",
    amount: 80000,
  };
  const fullMetrics = computeFinancialMetrics({
    invoices: [baseInvoice],
    vouchers: [clientCrv, fullVendorCpv],
    expenses: [],
    accounts: baseAccounts,
    refunds: [],
    periodStartYmd: "2026-11-01",
    periodEndYmd: "2026-11-30",
    todayYmd: "2026-11-23",
  });
  assert.equal(fullMetrics.vendorDues, 0, "Full purchasing cost paid leaves 0 vendor due");
  assert.equal(fullMetrics.periodProfit, 20000, "Profit stays Total - Cost");
  assert.equal(fullMetrics.clientDues, 60000);

  const vendorSettledLedger = buildPartyLedger({
    party: {
      id: "vendor-1",
      name: "PIA Consolidator",
      type: "vendor",
      opening_balance: 0,
      current_balance: 0,
    },
    bookingInvoices: [baseInvoice],
    paymentVouchers: [fullVendorCpv],
  });
  assert.equal(vendorSettledLedger.closingBalance, 0);
  assert.equal(vendorSettledLedger.hasMismatch, false);
});

test("3. Friendly error parser maps vendor payment errors without leaking SQL", () => {
  assert.equal(
    parseFriendlyError(
      new Error("Amount paid to vendor cannot exceed purchasing cost")
    ).userMessage,
    "Amount paid to vendor cannot exceed the purchasing cost."
  );
  assert.equal(
    parseFriendlyError(
      new Error("Please select a vendor when amount paid to vendor is greater than zero")
    ).userMessage,
    "Please select a vendor before entering an amount paid to vendor."
  );
  assert.equal(
    parseFriendlyError(
      new Error("Vendor payment at booking requires the latest database update. Nothing was saved.")
    ).userMessage,
    "Vendor payment at booking requires the latest database update. Nothing was saved — please apply the latest migration and try again."
  );
});

test("4. Static guardrails: SQL reuse, zero schema DDL, UI form & live refresh integration", () => {
  const migrationSql = fs.readFileSync(
    path.join(REPO_ROOT, "supabase/migrations/20261123170000_booking_invoice_vendor_payment.sql"),
    "utf8"
  );
  assert.match(migrationSql, /p_vendor_amount_paid NUMERIC DEFAULT 0/);
  assert.match(migrationSql, /public\.save_payment_voucher_atomic\(/);
  assert.match(migrationSql, /'AT-VENDOR-BOOKING-' \|\| v_inv_no/);
  assert.match(migrationSql, /'Initial payment to vendor at booking for ' \|\| v_inv_no/);
  assert.match(migrationSql, /p_request_id => NULL/);
  assert.match(migrationSql, /REVOKE ALL ON FUNCTION public\.save_booking_invoice_atomic/);
  assert.match(migrationSql, /GRANT EXECUTE ON FUNCTION public\.save_booking_invoice_atomic.*TO authenticated/);
  assert.doesNotMatch(migrationSql, /\b(CREATE|ALTER|DROP)\s+TABLE\b/i);

  const formSrc = fs.readFileSync(
    path.join(REPO_ROOT, "src/components/bookings/BookingInvoiceForm.tsx"),
    "utf8"
  );
  assert.doesNotMatch(formSrc, /Profit Preview Badge/);
  assert.doesNotMatch(formSrc, /liveProfit/);
  assert.match(formSrc, /Amount Paid to Vendor/);
  assert.match(formSrc, /p_vendor_amount_paid/);
  assert.match(formSrc, /edit_booking_invoice_atomic/);
  assert.match(formSrc, /useAgencyBranding/);

  const accountingSrc = fs.readFileSync(
    path.join(REPO_ROOT, "src/lib/accountingEngine.ts"),
    "utf8"
  );
  assert.match(accountingSrc, /"report_transactions"/);
  assert.match(accountingSrc, /"transactions"/);
  assert.match(accountingSrc, /"cash_bank_entries"/);

  const searchSrc = fs.readFileSync(
    path.join(REPO_ROOT, "src/components/GlobalSearchBar.tsx"),
    "utf8"
  );
  assert.match(searchSrc, /v\.direction === "out" \|\| v\.direction === "paid"/);
});
