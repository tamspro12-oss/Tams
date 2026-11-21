import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  canEditSalesDocument,
  hydrateInvoiceForEdit,
  evaluateInvoiceEdit,
  hydrateVoucherForEdit,
  evaluateVoucherEdit,
  hydrateRefundForEdit,
  evaluateRefundEdit,
  buildEditedRefundNotes,
  formatAuditFieldLabel,
  formatAuditFieldValue,
  formatPdfEditedNote,
} = await import("../src/lib/documentEditHelpers.ts");
const { computeFinancialMetrics } = await import("../src/lib/accountingEngine.ts");
const { parseFriendlyError } = await import("../src/lib/friendlyError.ts");

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("1. Edit invoice amount -> validates, flags ledger correction, and updates dues & profit", () => {
  const originalInvoice = {
    id: "inv-1",
    invoice_no: "INV-A00001-00000001",
    invoice_date: "2026-11-15",
    due_date: "2026-11-22",
    service: "Ticket",
    party_id: "client-1",
    vendor_id: "vendor-1",
    client_amount: 100000,
    vendor_payable: 80000,
    paid_amount: 40000,
    payment_status: "partial",
    pnr: "ABC123",
    ticket_no: "214-11111111",
    passengers: [{ name: "Ali Khan", passport: "PK12345", type: "Adult", gender: "Male", dob: "" }],
    more_details: {
      trip_type: "One Way",
      origin: "KHI",
      destination: "DXB",
      flight_date: "2026-11-20",
      airline: "Emirates",
    },
    notes: "Remarks: Standard fare",
  };

  const hydrated = hydrateInvoiceForEdit(originalInvoice);
  const edited = evaluateInvoiceEdit(
    hydrated.initialSnapshot,
    {
      clientAmount: 125000,
      vendorPayable: 90000,
      dueDate: hydrated.dueDate,
      serviceDetails: { ...hydrated.serviceDetails, pnr: "XYZ789" },
      passengers: hydrated.passengers,
      notes: hydrated.notes,
    },
    40000,
    "Updated fare & tax adjustment"
  );

  assert.equal(edited.ok, true);
  assert.equal(edited.noChanges, false);
  assert.equal(edited.affectsLedger, true);
  assert.deepEqual(edited.changedFields, ["client_amount", "vendor_payable", "pnr", "more_details"]);

  // Verify impossible edit (total < already paid) is blocked cleanly
  const impossible = evaluateInvoiceEdit(
    hydrated.initialSnapshot,
    {
      clientAmount: 30000,
      vendorPayable: 25000,
      dueDate: hydrated.dueDate,
      serviceDetails: hydrated.serviceDetails,
      passengers: hydrated.passengers,
      notes: hydrated.notes,
    },
    40000,
    "Attempt lower total"
  );
  assert.equal(impossible.ok, false);
  assert.match(impossible.error, /cannot be less than the amount already paid/i);

  // Verify metrics calculation reflects updated invoice amounts
  const accounts = [
    { id: "acc-cash", type: "cash", name: "Main Cash", opening_balance: 0, active: true },
  ];
  const vouchers = [
    {
      id: "v-1",
      direction: "received",
      amount: 40000,
      payment_mode: "cash",
      account_id: "acc-cash",
      party_id: "client-1",
    },
  ];
  const metricsAfter = computeFinancialMetrics({
    invoices: [
      {
        ...originalInvoice,
        client_amount: 125000,
        vendor_payable: 90000,
      },
    ],
    vouchers,
    expenses: [],
    accounts,
    refunds: [],
    periodStartYmd: "2026-11-01",
    periodEndYmd: "2026-11-30",
    todayYmd: "2026-11-21",
  });

  assert.equal(metricsAfter.clientDues, 85000, "Remaining client due = 125,000 - 40,000");
  assert.equal(metricsAfter.vendorDues, 90000, "Vendor due = 90,000");
  assert.equal(metricsAfter.periodProfit, 35000, "Profit = 125,000 - 90,000");
});

test("2. Edit voucher amount and mode (cash -> bank) -> updates balances and linked invoice status", () => {
  const accounts = [
    { id: "acc-cash", type: "cash", name: "Main Cash", opening_balance: 0, active: true },
    { id: "acc-bank", type: "bank", name: "Meezan Bank", opening_balance: 0, active: true },
  ];

  const origVoucher = {
    id: "vch-1",
    voucher_no: "CRV-00000001",
    voucher_date: "2026-11-15",
    direction: "received",
    payment_mode: "cash",
    account_id: "acc-cash",
    party_id: "client-1",
    amount: 40000,
    reference_no: "",
    notes: "Initial cash receipt",
  };

  const hydrated = hydrateVoucherForEdit(origVoucher, accounts);
  const edited = evaluateVoucherEdit(
    hydrated.initialSnapshot,
    {
      amount: 125000,
      paymentMode: "bank",
      selectedBank: "Meezan Bank",
      referenceNo: "MB-TRX-778",
      notes: "Settled via bank transfer",
    },
    "Client settled full invoice via Meezan Bank"
  );

  assert.equal(edited.ok, true);
  assert.equal(edited.noChanges, false);
  assert.equal(edited.affectsLedger, true);
  assert.deepEqual(edited.changedFields, [
    "amount",
    "payment_mode",
    "bank_name",
    "reference_no",
    "notes",
  ]);

  // Missing bank when mode changed to bank/transfer must be blocked
  const missingBank = evaluateVoucherEdit(
    hydrated.initialSnapshot,
    {
      amount: 60000,
      paymentMode: "transfer",
      selectedBank: "",
      referenceNo: "",
      notes: hydrated.notes,
    },
    "Switched to transfer without selecting bank"
  );
  assert.equal(missingBank.ok, false);
  assert.match(missingBank.error, /select an agency bank/i);

  // Verify balances after Cash (0) -> Meezan Bank (+125,000) & invoice paid
  const metricsAfter = computeFinancialMetrics({
    invoices: [
      {
        id: "inv-1",
        invoice_date: "2026-11-15",
        party_id: "client-1",
        client_amount: 125000,
        vendor_payable: 90000,
        paid_amount: 125000,
        payment_status: "paid",
      },
    ],
    vouchers: [{ ...origVoucher, amount: 125000, payment_mode: "bank", account_id: "acc-bank" }],
    expenses: [],
    accounts: [
      { id: "acc-cash", type: "cash", name: "Main Cash", current_balance: 0, active: true },
      { id: "acc-bank", type: "bank", name: "Meezan Bank", current_balance: 125000, active: true },
    ],
    refunds: [],
    periodStartYmd: "2026-11-01",
    periodEndYmd: "2026-11-30",
    todayYmd: "2026-11-21",
  });

  assert.equal(metricsAfter.cashAndBank, 125000);
  assert.equal(metricsAfter.clientDues, 0);
});

test("3. Edit refund -> validates, preserves metadata tokens in notes, and updates totals", () => {
  const origRefund = {
    id: "ref-1",
    refund_no: "RF-00000001",
    refund_date: "2026-11-16",
    refund_type: "refund",
    refund_amount: 20000,
    client_refund_amount: 20000,
    vendor_refund_amount: 15000,
    deductions: 2000,
    reason: "Schedule change",
    notes:
      "Initial penalty | Service Charges/Deductions: PKR 2000 | Ref Invoice: INV-0001 | Party: Ali Khan",
  };

  const hydrated = hydrateRefundForEdit(origRefund);
  assert.equal(hydrated.notes, "Initial penalty");
  assert.deepEqual(hydrated.preservedMetaTokens, ["Ref Invoice: INV-0001", "Party: Ali Khan"]);

  const edited = evaluateRefundEdit(
    hydrated.initialSnapshot,
    {
      clientRefundAmount: 35000,
      vendorRefundAmount: 25000,
      deductionsAmount: 1000,
      reason: "Airline waived penalty",
      notes: "Waiver approved by airline",
    },
    hydrated.actionType,
    "Airline issued full waiver"
  );

  assert.equal(edited.ok, true);
  assert.equal(edited.affectsLedger, true);
  const rebuiltNotes = buildEditedRefundNotes(
    "Waiver approved by airline",
    1000,
    hydrated.preservedMetaTokens
  );
  assert.match(rebuiltNotes, /Ref Invoice: INV-0001/);
  assert.match(rebuiltNotes, /Party: Ali Khan/);
  assert.match(rebuiltNotes, /Service Charges\/Deductions: PKR 1000/);
});

test("4. No-change edit does nothing & missing edit reason is blocked across all 3 forms", () => {
  const invH = hydrateInvoiceForEdit({
    id: "inv-noop",
    invoice_no: "INV-1",
    invoice_date: "2026-11-10",
    service: "Ticket",
    client_amount: 50000,
    vendor_payable: 40000,
    paid_amount: 0,
    passengers: [],
    more_details: {},
    notes: "",
  });
  const invNoop = evaluateInvoiceEdit(
    invH.initialSnapshot,
    {
      clientAmount: 50000,
      vendorPayable: 40000,
      dueDate: invH.dueDate,
      serviceDetails: invH.serviceDetails,
      passengers: invH.passengers,
      notes: invH.notes,
    },
    0,
    ""
  );
  assert.equal(invNoop.ok, true);
  assert.equal(invNoop.noChanges, true);

  const invNoReason = evaluateInvoiceEdit(
    invH.initialSnapshot,
    {
      clientAmount: 55000,
      vendorPayable: 40000,
      dueDate: invH.dueDate,
      serviceDetails: invH.serviceDetails,
      passengers: invH.passengers,
      notes: invH.notes,
    },
    0,
    "   "
  );
  assert.equal(invNoReason.ok, false);
  assert.match(invNoReason.error, /reason for this edit/i);

  const vchH = hydrateVoucherForEdit({
    id: "vch-noop",
    amount: 10000,
    payment_mode: "cash",
    reference_no: "REF1",
    notes: "Test",
  });
  assert.equal(
    evaluateVoucherEdit(
      vchH.initialSnapshot,
      {
        amount: 10000,
        paymentMode: "cash",
        selectedBank: "",
        referenceNo: "REF1",
        notes: "Test",
      },
      ""
    ).noChanges,
    true
  );
  assert.equal(
    evaluateVoucherEdit(
      vchH.initialSnapshot,
      {
        amount: 12000,
        paymentMode: "cash",
        selectedBank: "",
        referenceNo: "REF1",
        notes: "Test",
      },
      ""
    ).ok,
    false
  );

  const refH = hydrateRefundForEdit({
    id: "ref-noop",
    refund_type: "refund",
    refund_amount: 5000,
    reason: "Cancel",
    notes: "Note",
  });
  assert.equal(
    evaluateRefundEdit(
      refH.initialSnapshot,
      {
        clientRefundAmount: 5000,
        vendorRefundAmount: 0,
        deductionsAmount: 0,
        reason: "Cancel",
        notes: "Note",
      },
      "refund",
      ""
    ).noChanges,
    true
  );
  assert.equal(
    evaluateRefundEdit(
      refH.initialSnapshot,
      {
        clientRefundAmount: 6000,
        vendorRefundAmount: 0,
        deductionsAmount: 0,
        reason: "Cancel",
        notes: "Note",
      },
      "refund",
      ""
    ).ok,
    false
  );
});

test("5. Old pre-feature records hydrate cleanly without audit fields and format PDF note safely", () => {
  const legacyInvoice = {
    id: "legacy-inv-1",
    invoice_no: "INV-2025-0010",
    invoice_date: "2025-08-12",
    service: "Visa",
    client_amount: 25000,
    vendor_payable: 18000,
    paid_amount: 0,
    pnr: null,
    ticket_no: null,
    passengers: null,
    more_details: null,
    notes: null,
    // no is_edited / edit_count / last_edited_at columns populated
  };
  const invH = hydrateInvoiceForEdit(legacyInvoice);
  assert.equal(invH.service, "Visa");
  assert.equal(invH.totalAmount, "25000");
  assert.equal(
    evaluateInvoiceEdit(
      invH.initialSnapshot,
      {
        clientAmount: 25000,
        vendorPayable: 18000,
        dueDate: invH.dueDate,
        serviceDetails: invH.serviceDetails,
        passengers: invH.passengers,
        notes: invH.notes,
      },
      0,
      ""
    ).noChanges,
    true
  );

  assert.equal(formatPdfEditedNote(false, null), null);
  assert.equal(formatPdfEditedNote(undefined, undefined), null);
  const pdfNote = formatPdfEditedNote(true, "2026-11-21T10:15:00.000Z");
  assert.match(pdfNote, /^Edited on 21 Nov 2026$/);
  assert.equal(formatAuditFieldLabel("client_amount"), "Total Amount (PKR)");
  assert.equal(formatAuditFieldValue("client_amount", 125000), "PKR 125,000");
});

test("6. Permissions & SQL migration guardrails enforce strict agency isolation and append-only audit log", () => {
  // Agency owner always permitted
  assert.equal(canEditSalesDocument({ isSubUser: false }, "booking_invoice"), true);
  assert.equal(canEditSalesDocument({ isSubUser: false }, "payment_voucher"), true);
  assert.equal(canEditSalesDocument({ isSubUser: false }, "refund"), true);

  // Deactivated sub-user blocked even with write=true
  assert.equal(
    canEditSalesDocument(
      {
        isSubUser: true,
        isActive: false,
        permissions: { bookings: { read: true, write: true } },
      },
      "booking_invoice"
    ),
    false
  );

  // Read-only sub-user blocked
  assert.equal(
    canEditSalesDocument(
      {
        isSubUser: true,
        isActive: true,
        permissions: {
          bookings: { read: true, write: false },
          invoices: { read: true, write: false },
          clients: { read: true, write: false },
          vendors: { read: true, write: false },
        },
      },
      "payment_voucher"
    ),
    false
  );

  // Sub-user with bookings write=true allowed
  assert.equal(
    canEditSalesDocument(
      {
        isSubUser: true,
        isActive: true,
        permissions: { bookings: { read: true, write: true } },
      },
      "booking_invoice"
    ),
    true
  );

  // Static audit of migration SQL
  const sql = fs.readFileSync(
    path.join(REPO_ROOT, "supabase/migrations/20261121_03_sales_expenses_edit_audit.sql"),
    "utf8"
  );
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.document_edit_history/);
  assert.match(sql, /ALTER TABLE public\.document_edit_history ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE UPDATE, DELETE ON public\.document_edit_history FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /CREATE TRIGGER trg_immutable_document_edit_history/);
  assert.match(sql, /CREATE TRIGGER trg_isolation_document_edit_history/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.edit_booking_invoice_atomic/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.edit_payment_voucher_atomic/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.edit_refund_atomic/);
  assert.match(sql, /assert_agency_scope/);
  assert.match(sql, /assert_module_permission/);
  assert.match(sql, /agency_license_ok/);
});

test("7. Friendly error parser hides raw SQL/Postgres details for failed edit rollbacks", () => {
  const err1 = parseFriendlyError({ message: "Edit reason is required" });
  assert.equal(err1.userMessage, "Please enter a reason for this edit.");

  const err2 = parseFriendlyError({
    code: "42501",
    message: "403 Forbidden: Audit history is append-only and cannot be modified or deleted",
  });
  assert.equal(err2.userMessage, "Audit history cannot be modified or deleted.");

  const err3 = parseFriendlyError({
    message: "Voided or refunded invoices cannot be edited",
  });
  assert.equal(err3.userMessage, "Voided or refunded invoices cannot be edited.");

  const errRawSql = parseFriendlyError({
    message: "ERROR: column booking_invoices.bad_col does not exist in relation public.booking_invoices",
  });
  assert.doesNotMatch(errRawSql.userMessage, /relation|column|public\./i);
});

