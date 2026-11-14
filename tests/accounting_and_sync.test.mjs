import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const {
  computeFinancialMetrics,
  isInvoiceVoidedOrRefunded,
  resolveAccountIdForPayment,
} = await import("../src/lib/accountingEngine.ts");
const { getInvoiceOverdueInfo } = await import("../src/lib/overdueUtils.ts");
const { isDateWithinPreset } = await import("../src/lib/dateFilterUtils.ts");
const { getKarachiYmd } = await import("../src/lib/karachiTime.ts");

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Task 4 scenario: 100k booking, 80k cost, 40k client pay, 30k vendor pay -> exact dues, cash & profit", () => {
  const accounts = [
    { id: "acc-cash", name: "Cash in Hand", type: "cash", opening_balance: 0, active: true },
    { id: "acc-bank", name: "HBL Main", type: "bank", opening_balance: 0, active: true },
  ];

  const invoices = [
    {
      id: "inv-1",
      invoice_no: "INV-0001",
      invoice_date: "2026-11-10",
      due_date: "2026-11-05",
      client_amount: 100000,
      vendor_payable: 80000,
      paid_amount: 40000,
      payment_status: "partial",
      is_void: false,
      party_id: "party-client-1",
      vendor_id: "party-vendor-1",
    },
  ];

  const vouchers = [
    {
      id: "v-in-1",
      direction: "received",
      amount: 40000,
      voucher_date: "2026-11-10",
      payment_mode: "cash",
      account_id: "acc-cash",
      party_id: "party-client-1",
      invoice_id: "inv-1",
      is_void: false,
    },
    {
      id: "v-out-1",
      direction: "paid",
      amount: 30000,
      voucher_date: "2026-11-10",
      payment_mode: "cash",
      account_id: "acc-cash",
      party_id: "party-vendor-1",
      invoice_id: "inv-1",
      is_void: false,
    },
  ];

  const beforeExpense = computeFinancialMetrics({
    invoices,
    vouchers,
    expenses: [],
    accounts,
    refunds: [],
    clients: [],
    vendors: [],
    periodStartYmd: "2026-11-01",
    periodEndYmd: "2026-11-30",
    todayYmd: "2026-11-10",
  });

  assert.equal(beforeExpense.clientDues, 60000, "Client due must be 100,000 - 40,000 = 60,000");
  assert.equal(beforeExpense.vendorDues, 50000, "Vendor due must be 80,000 - 30,000 = 50,000");
  assert.equal(beforeExpense.periodProfit, 20000, "Profit must be 100,000 - 80,000 = 20,000");
  assert.equal(beforeExpense.cashAndBank, 10000, "Cash & Bank must be 40,000 - 30,000 = 10,000");
  assert.equal(beforeExpense.todaysBookings, 1, "Today booking count in Asia/Karachi should be 1");
  assert.equal(beforeExpense.overdueCount, 1, "Unpaid booking due 2026-11-05 must count as 1 overdue");

  const withExpense = computeFinancialMetrics({
    invoices,
    vouchers,
    expenses: [{ id: "exp-1", amount: 5000, expense_date: "2026-11-10", account_id: "acc-cash" }],
    accounts,
    refunds: [],
    clients: [],
    vendors: [],
    periodStartYmd: "2026-11-01",
    periodEndYmd: "2026-11-30",
    todayYmd: "2026-11-10",
  });

  assert.equal(withExpense.periodProfit, 15000, "Net profit must subtract expenses (20,000 - 5,000)");
  assert.equal(withExpense.cashAndBank, 5000, "Cash & Bank must subtract expenses (10,000 - 5,000)");

  // When accounts already carry RPC-computed current_balance (e.g. account_balances()),
  // it must NOT double-count vouchers/expenses, and transfers between accounts must net to zero.
  const transferAndPrecomputed = computeFinancialMetrics({
    invoices,
    vouchers: [
      ...vouchers,
      { id: "v-tr-1", direction: "transfer", amount: 5000, voucher_date: "2026-11-10", is_void: false },
    ],
    expenses: [{ id: "exp-1", amount: 5000, expense_date: "2026-11-10" }],
    accounts: [
      { id: "acc-cash", name: "Cash in Hand", type: "cash", opening_balance: 0, current_balance: 0, active: true },
      { id: "acc-bank", name: "HBL Main", type: "bank", opening_balance: 0, current_balance: 5000, active: true },
    ],
    refunds: [],
    clients: [],
    vendors: [],
    periodStartYmd: "2026-11-01",
    periodEndYmd: "2026-11-30",
    todayYmd: "2026-11-10",
  });
  assert.equal(transferAndPrecomputed.cashAndBank, 5000, "RPC current_balance + transfer nets to 5,000 without double-counting");
});

test("Task 4 scenario after full void/refund: clears client dues, vendor dues, profit, and overdue count", () => {
  const accounts = [
    { id: "acc-cash", name: "Cash in Hand", type: "cash", opening_balance: 0, active: true },
  ];

  const refundedInvoices = [
    {
      id: "inv-1",
      invoice_no: "INV-0001",
      invoice_date: "2026-11-10",
      due_date: "2026-11-05",
      client_amount: 100000,
      vendor_payable: 80000,
      paid_amount: 40000,
      payment_status: "refunded",
      is_void: true,
      party_id: "party-client-1",
      vendor_id: "party-vendor-1",
    },
  ];

  const vouchers = [
    {
      id: "v-in-1",
      direction: "received",
      amount: 40000,
      voucher_date: "2026-11-10",
      payment_mode: "cash",
      account_id: "acc-cash",
      party_id: "party-client-1",
      invoice_id: "inv-1",
    },
    {
      id: "v-out-1",
      direction: "paid",
      amount: 30000,
      voucher_date: "2026-11-10",
      payment_mode: "cash",
      account_id: "acc-cash",
      party_id: "party-vendor-1",
      invoice_id: "inv-1",
    },
  ];

  const refunds = [
    {
      id: "ref-1",
      refund_date: "2026-11-11",
      client_refund_amount: 40000,
      vendor_refund_amount: 30000,
      account_id: "acc-cash",
    },
  ];

  const afterRefund = computeFinancialMetrics({
    invoices: refundedInvoices,
    vouchers,
    expenses: [],
    accounts,
    refunds,
    clients: [],
    vendors: [],
    periodStartYmd: "2026-11-01",
    periodEndYmd: "2026-11-30",
    todayYmd: "2026-11-11",
  });

  assert.equal(isInvoiceVoidedOrRefunded(refundedInvoices[0]), true);
  assert.equal(afterRefund.clientDues, 0, "Voided/refunded invoice must leave 0 client due");
  assert.equal(afterRefund.vendorDues, 0, "Voided/refunded invoice must leave 0 vendor due");
  assert.equal(afterRefund.periodProfit, 0, "Voided/refunded booking must be excluded from profit");
  assert.equal(afterRefund.overdueCount, 0, "Voided/refunded booking must not appear overdue");
  assert.equal(afterRefund.cashAndBank, 0, "Refund outflow 40k & vendor refund inflow 30k net cash back to 0");
});

test("Task 4 account resolution: resolves active cash/bank IDs cleanly and skips inactive accounts", () => {
  const accounts = [
    { id: "acc-inactive", name: "Closed Bank", type: "bank", active: false },
    { id: "acc-cash", name: "Cash Counter", type: "cash", active: true },
    { id: "acc-meezan", name: "Meezan Bank (1234)", type: "bank", active: true },
  ];

  assert.equal(resolveAccountIdForPayment(accounts, "cash"), "acc-cash");
  assert.equal(resolveAccountIdForPayment(accounts, "bank", "Meezan"), "acc-meezan");
  assert.equal(resolveAccountIdForPayment(accounts, "bank", "Unknown Bank"), "acc-meezan");
  assert.equal(resolveAccountIdForPayment([], "cash"), null);
});

test("Task 4 overdue rules: excludes paid/void/refunded invoices and calculates overdueDays in Asia/Karachi", () => {
  const refDate = new Date("2026-11-10T10:00:00Z");

  assert.equal(
    getInvoiceOverdueInfo(
      { client_amount: 50000, paid_amount: 50000, payment_status: "paid", due_date: "2026-11-01" },
      refDate
    ).isOverdue,
    false
  );
  assert.equal(
    getInvoiceOverdueInfo(
      { client_amount: 50000, paid_amount: 0, payment_status: "void", is_void: true, due_date: "2026-11-01" },
      refDate
    ).isOverdue,
    false
  );

  const overdue = getInvoiceOverdueInfo(
    { client_amount: 50000, paid_amount: 10000, payment_status: "partial", due_date: "2026-11-07" },
    refDate
  );
  assert.equal(overdue.isOverdue, true);
  assert.equal(overdue.overdueDays, 3);
});

test("Task 5 timezone normalization: treats UTC+5 Asia/Karachi midnight accurately", () => {
  // 2026-11-14T20:30:00Z is 2026-11-15 01:30 in Asia/Karachi (UTC+5)
  const utcEveningInKarachiNextDay = new Date("2026-11-14T20:30:00.000Z");
  assert.equal(getKarachiYmd(utcEveningInKarachiNextDay), "2026-11-15");

  assert.equal(isDateWithinPreset("2026-11-15", "custom", "2026-11-01", "2026-11-15"), true);
  assert.equal(isDateWithinPreset("2026-10-31", "custom", "2026-11-01", "2026-11-15"), false);
});

test("Tasks 1 & 3 & 5 static guardrails: no hardcoded admin email whitelist or tams_agency_id localStorage usage", () => {
  const srcDir = path.join(REPO_ROOT, "src");
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  walk(srcDir);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const rel = path.relative(REPO_ROOT, file);
    assert.equal(
      content.includes("tams_agency_id"),
      false,
      `${rel} must not read/write tams_agency_id in localStorage`
    );
    assert.equal(
      content.includes("usmn4u@gmail.com"),
      false,
      `${rel} must not contain hardcoded super_admin email whitelist`
    );
  }
});
