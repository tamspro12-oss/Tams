import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const {
  hasPaymentPermission,
  resolveVoucherOpenState,
  buildPaymentVoucherUrl,
  parsePaymentVoucherUrlParams,
  clearPaymentVoucherUrlParams,
} = await import("../src/lib/paymentVoucherHelpers.ts");

const { openPaymentVoucher, registerPaymentVoucherHost } = await import(
  "../src/lib/openPaymentVoucher.ts"
);

const {
  formatDrCrAmount,
  getDrCrLabelForParty,
  buildPartyLedger,
  filterPartyLedgerRows,
  validateStatementPeriod,
  buildPartyStatement,
} = await import("../src/lib/partyLedger.ts");

const SAMPLE_CLIENT = {
  id: "party-client-1",
  code: "C-001",
  name: "Al-Noor Travels Client",
  type: "client",
  opening_balance: 5000,
  current_balance: 9500,
};

const SAMPLE_VENDOR = {
  id: "party-vendor-1",
  code: "V-001",
  name: "Saudia Airline Supplier",
  type: "vendor",
  opening_balance: 0,
  current_balance: -15000,
};

const SAMPLE_PARTIES = [SAMPLE_CLIENT, SAMPLE_VENDOR];

// CHECK 1: clicking New Payment on a client opens the voucher form with that party selected and direction "Received"
test("1. New Payment on client pre-fills that party and direction 'received'", () => {
  let openedPayload = null;
  const unregister = registerPaymentVoucherHost({
    openDialog: (payload) => {
      openedPayload = payload;
    },
    getPermissionState: () => ({ isSubUser: false }),
    resolvePartyDirection: (partyId) => {
      const p = SAMPLE_PARTIES.find((x) => x.id === partyId);
      return p?.type === "vendor" ? "paid" : "received";
    },
  });

  try {
    const outcome = openPaymentVoucher({ partyId: SAMPLE_CLIENT.id });
    assert.deepEqual(outcome, { opened: true, mode: "dialog" });
    assert.equal(openedPayload.partyId, SAMPLE_CLIENT.id);
    assert.equal(openedPayload.direction, "received");

    const resolved = resolveVoucherOpenState({
      partyId: openedPayload.partyId,
      direction: openedPayload.direction,
      parties: SAMPLE_PARTIES,
      isLoadingParties: false,
      hasPermission: true,
    });
    assert.equal(resolved.status, "ready");
    assert.equal(resolved.partyId, SAMPLE_CLIENT.id);
    assert.equal(resolved.party?.name, SAMPLE_CLIENT.name);
    assert.equal(resolved.direction, "received");
  } finally {
    unregister();
  }
});

// CHECK 2: on a vendor, direction "Paid"
test("2. New Payment on vendor pre-fills that party and direction 'paid'", () => {
  let openedPayload = null;
  const unregister = registerPaymentVoucherHost({
    openDialog: (payload) => {
      openedPayload = payload;
    },
    getPermissionState: () => ({ isSubUser: false }),
    resolvePartyDirection: (partyId) => {
      const p = SAMPLE_PARTIES.find((x) => x.id === partyId);
      return p?.type === "vendor" ? "paid" : "received";
    },
  });

  try {
    const outcome = openPaymentVoucher({ partyId: SAMPLE_VENDOR.id });
    assert.deepEqual(outcome, { opened: true, mode: "dialog" });
    assert.equal(openedPayload.partyId, SAMPLE_VENDOR.id);
    assert.equal(openedPayload.direction, "paid");

    const resolved = resolveVoucherOpenState({
      partyId: openedPayload.partyId,
      direction: openedPayload.direction,
      parties: SAMPLE_PARTIES,
      isLoadingParties: false,
      hasPermission: true,
    });
    assert.equal(resolved.status, "ready");
    assert.equal(resolved.partyId, SAMPLE_VENDOR.id);
    assert.equal(resolved.direction, "paid");
  } finally {
    unregister();
  }
});

// CHECK 3: opening by URL params works and the params are cleared
test("3. Opening by URL params opens form with prefill and clears transient params after opening", () => {
  let navigatedUrl = null;
  const fallbackOutcome = openPaymentVoucher(
    { partyId: SAMPLE_VENDOR.id, direction: "paid" },
    {
      openDialog: undefined,
      navigate: (url) => {
        navigatedUrl = url;
      },
      getPermissionState: () => ({ isSubUser: false }),
    }
  );

  assert.equal(fallbackOutcome.opened, true);
  assert.equal(fallbackOutcome.mode, "navigation");
  assert.equal(
    navigatedUrl,
    buildPaymentVoucherUrl({ partyId: SAMPLE_VENDOR.id, direction: "paid" })
  );

  const rawQuery = navigatedUrl.split("?")[1];
  const sp = new URLSearchParams(rawQuery);
  const parsed = parsePaymentVoucherUrlParams(sp);

  assert.equal(parsed.shouldOpen, true);
  assert.equal(parsed.partyId, SAMPLE_VENDOR.id);
  assert.equal(parsed.direction, "paid");
  assert.equal(parsed.hasTransientParams, true);

  // Immediately clear transient params after opening so refresh won't reopen
  const cleared = clearPaymentVoucherUrlParams(sp);
  const afterClear = parsePaymentVoucherUrlParams(cleared);
  assert.equal(cleared.get("tab"), "payment-vouchers");
  assert.equal(afterClear.shouldOpen, false);
  assert.equal(afterClear.hasTransientParams, false);
  assert.equal(cleared.get("party"), null);
  assert.equal(cleared.get("direction"), null);
});

// CHECK 4: unknown party id opens the empty form with a friendly message
test("4. Unknown party id resolves to empty selector with friendly message and never crashes", () => {
  const whileLoading = resolveVoucherOpenState({
    partyId: "unknown-id-999",
    parties: [],
    isLoadingParties: true,
    hasPermission: true,
  });
  assert.equal(whileLoading.status, "loading");
  assert.equal(whileLoading.friendlyMessage, null);

  const afterLoaded = resolveVoucherOpenState({
    partyId: "unknown-id-999",
    parties: SAMPLE_PARTIES,
    isLoadingParties: false,
    hasPermission: true,
  });
  assert.equal(afterLoaded.status, "not_found");
  assert.equal(afterLoaded.partyId, "");
  assert.equal(afterLoaded.party, null);
  assert.ok(afterLoaded.friendlyMessage);
  assert.doesNotMatch(afterLoaded.friendlyMessage, /sql|postgres|403|null|exception/i);
});

// CHECK 5: a user without payment permission cannot open it
test("5. User without payment permission is blocked in both shared opener and URL open state", () => {
  const noPaymentSubUser = {
    isSubUser: true,
    isActive: true,
    isLoading: false,
    permissions: {
      dashboard: true,
      reports: { read: true, write: false },
      bookings: false,
      invoices: false,
      clients: { read: true, write: false },
      vendors: { read: true, write: false },
    },
  };

  assert.equal(hasPaymentPermission(noPaymentSubUser), false);
  assert.equal(
    hasPaymentPermission({
      isSubUser: true,
      isActive: true,
      permissions: { payments: { read: true, write: false }, bookings: true },
    }),
    false
  );
  assert.equal(
    hasPaymentPermission({
      isSubUser: true,
      isActive: true,
      permissions: { payments: true },
    }),
    true
  );

  let dialogCalled = false;
  let errorMsg = "";
  const outcome = openPaymentVoucher(
    { partyId: SAMPLE_CLIENT.id },
    {
      openDialog: () => {
        dialogCalled = true;
      },
      getPermissionState: () => noPaymentSubUser,
      notifyError: (msg) => {
        errorMsg = msg;
      },
    }
  );

  assert.deepEqual(outcome, { opened: false, reason: "forbidden" });
  assert.equal(dialogCalled, false);
  assert.match(errorMsg, /permission/i);

  const state = resolveVoucherOpenState({
    partyId: SAMPLE_CLIENT.id,
    parties: SAMPLE_PARTIES,
    hasPermission: hasPaymentPermission(noPaymentSubUser),
  });
  assert.equal(state.status, "forbidden");
  assert.equal(state.partyId, "");
  assert.match(state.friendlyMessage || "", /permission/i);
});

// CHECK 6: running-balance calculation (oldest-to-newest compute, newest-first display, opening balance included)
test("6. Running balance calculates chronologically from opening balance and returns newest-first display rows", () => {
  const ledger = buildPartyLedger({
    party: {
      ...SAMPLE_CLIENT,
      created_at: "2026-10-01T09:00:00Z",
      opening_balance: 5000,
      current_balance: 9500,
    },
    bookingInvoices: [
      {
        id: "inv-2",
        invoice_no: "INV-002",
        invoice_date: "2026-10-05",
        party_id: SAMPLE_CLIENT.id,
        client_amount: 10000,
        service: "Ticket",
        pnr: "ABC123",
        created_at: "2026-10-05T10:00:00Z",
      },
      {
        id: "inv-3",
        invoice_no: "INV-003",
        invoice_date: "2026-10-06",
        party_id: SAMPLE_CLIENT.id,
        client_amount: 4000,
        service: "Visa",
        is_void: true,
        void_reason: "Cancelled by passenger",
        voided_at: "2026-10-06",
        created_at: "2026-10-06T11:00:00Z",
      },
    ],
    paymentVouchers: [
      {
        id: "pv-1",
        voucher_no: "CRV-001",
        voucher_date: "2026-10-10",
        party_id: SAMPLE_CLIENT.id,
        direction: "received",
        amount: 7000,
        payment_mode: "cash",
        created_at: "2026-10-10T12:00:00Z",
      },
    ],
    refunds: [
      {
        id: "ref-1",
        refund_no: "REF-001",
        refund_date: "2026-10-12",
        party_id: SAMPLE_CLIENT.id,
        client_refund_amount: 1500,
        reason: "Cash refund",
        created_at: "2026-10-12T13:00:00Z",
      },
    ],
  });

  // Oldest first: Opening (5000) -> INV-002 (15000) -> INV-003 (19000) -> VOID INV-003 (15000) -> CRV-001 (8000) -> REF-001 (9500)
  assert.equal(ledger.entriesOldestFirst.length, 6);
  assert.deepEqual(
    ledger.entriesOldestFirst.map((e) => [e.reference, e.runningBalance]),
    [
      ["OPENING", 5000],
      ["INV-002", 15000],
      ["INV-003", 19000],
      ["INV-003", 15000],
      ["CRV-001", 8000],
      ["REF-001", 9500],
    ]
  );

  // Newest first display
  assert.equal(ledger.entriesNewestFirst[0].reference, "REF-001");
  assert.equal(ledger.entriesNewestFirst[0].runningBalance, 9500);
  assert.equal(ledger.entriesNewestFirst[ledger.entriesNewestFirst.length - 1].isOpening, true);
  assert.equal(ledger.closingBalance, 9500);
  assert.equal(ledger.hasMismatch, false);
});

// CHECK 7: DR/CR labels for client vs vendor
test("7. DR/CR formatting and client vs vendor status labels", () => {
  assert.equal(formatDrCrAmount(12000), "PKR 12,000 DR");
  assert.equal(formatDrCrAmount(-15000), "PKR 15,000 CR");
  assert.equal(formatDrCrAmount(0), "PKR 0");

  assert.equal(getDrCrLabelForParty(12000, "client").code, "DR");
  assert.equal(getDrCrLabelForParty(12000, "client").statusLabel, "Receivable (DR)");
  assert.equal(getDrCrLabelForParty(-2500, "client").code, "CR");
  assert.equal(getDrCrLabelForParty(-2500, "client").statusLabel, "Advance / Credit (CR)");

  assert.equal(getDrCrLabelForParty(-15000, "vendor").code, "CR");
  assert.equal(getDrCrLabelForParty(-15000, "vendor").statusLabel, "Payable (CR)");
  assert.equal(getDrCrLabelForParty(3000, "vendor").code, "DR");
  assert.equal(getDrCrLabelForParty(3000, "vendor").statusLabel, "Advance / Receivable (DR)");
  assert.equal(getDrCrLabelForParty(0, "vendor").statusLabel, "Settled");
});

// CHECK 8 & 9 & 10: Statement period filtering (inclusive bounds), brought forward, closing balance == current balance when ending today
test("8-10. Statement includes From & To dates, excludes outside rows, computes brought forward accurately, and matches current balance when ending today", () => {
  const ledger = buildPartyLedger({
    party: {
      id: "party-period-1",
      code: "C-777",
      name: "Period Check Client",
      type: "client",
      created_at: "2026-10-01T00:00:00Z",
      opening_balance: 5000,
      current_balance: 14000,
    },
    bookingInvoices: [
      // Before From (Oct 31): +3000 -> BF becomes 8000
      {
        id: "i1",
        invoice_no: "INV-OCT",
        invoice_date: "2026-10-31",
        party_id: "party-period-1",
        client_amount: 3000,
        created_at: "2026-10-31T10:00:00Z",
      },
      // Exactly on From (Nov 01): +4000
      {
        id: "i2",
        invoice_no: "INV-NOV1",
        invoice_date: "2026-11-01",
        party_id: "party-period-1",
        client_amount: 4000,
        created_at: "2026-11-01T10:00:00Z",
      },
      // Exactly on To (Nov 16 / today): +5000
      {
        id: "i3",
        invoice_no: "INV-NOV16",
        invoice_date: "2026-11-16",
        party_id: "party-period-1",
        client_amount: 5000,
        created_at: "2026-11-16T10:00:00Z",
      },
      // After To (Nov 17): excluded from period
      {
        id: "i4",
        invoice_no: "INV-NOV17",
        invoice_date: "2026-11-17",
        party_id: "party-period-1",
        client_amount: 2000,
        created_at: "2026-11-17T10:00:00Z",
      },
    ],
    paymentVouchers: [
      // Before From (Oct 31): -1000 -> BF becomes 5000 + 3000 - 1000 = 7000
      {
        id: "p1",
        voucher_no: "CRV-OCT",
        voucher_date: "2026-10-31",
        party_id: "party-period-1",
        direction: "received",
        amount: 1000,
        created_at: "2026-10-31T12:00:00Z",
      },
      // Inside period (Nov 10): -2000 -> net in period +4000 +5000 -2000 = +7000
      {
        id: "p2",
        voucher_no: "CRV-NOV10",
        voucher_date: "2026-11-10",
        party_id: "party-period-1",
        direction: "received",
        amount: 2000,
        created_at: "2026-11-10T12:00:00Z",
      },
    ],
  });

  // Period 2026-11-01..2026-11-16 (ending today 2026-11-16)
  // Using a party whose stored current_balance excludes future dated Nov 17 invoice (14,000 up to Nov 16)
  const stmt = buildPartyStatement({
    party: {
      id: "party-period-1",
      code: "C-777",
      name: "Period Check Client",
      type: "client",
      opening_balance: 5000,
      current_balance: 14000,
    },
    ledger,
    preset: "custom",
    customFrom: "2026-11-01",
    customTo: "2026-11-16",
    todayYmd: "2026-11-16",
  });

  assert.equal(stmt.valid, true);
  // Check 8: inclusive boundaries & exclusion of Oct 31 / Nov 17
  assert.deepEqual(
    stmt.entries.map((e) => e.reference),
    ["INV-NOV1", "CRV-NOV10", "INV-NOV16"]
  );
  // Check 9: brought forward = opening (5000) + Oct 31 invoice (3000) - Oct 31 payment (1000) = 7000
  assert.equal(stmt.broughtForward, 7000);
  assert.equal(stmt.totalDebit, 9000);
  assert.equal(stmt.totalCredit, 2000);
  // Check 10: closing balance ending today equals storedCurrentBalance (7000 + 9000 - 2000 = 14000)
  assert.equal(stmt.closingBalance, 14000);
  assert.equal(stmt.period.endsToday, true);
  assert.equal(stmt.hasMismatch, false);

  // All time brought forward equals opening balance
  const allTimeStmt = buildPartyStatement({
    party: {
      id: "party-period-1",
      code: "C-777",
      name: "Period Check Client",
      type: "client",
      opening_balance: 5000,
      current_balance: 16000,
    },
    ledger,
    preset: "all_time",
    todayYmd: "2026-11-16",
  });
  assert.equal(allTimeStmt.broughtForward, 5000);
});

// CHECK 11: From after To is blocked with a friendly message
test("11. Custom range validation blocks From > To, missing dates, and invalid calendar dates with friendly errors", () => {
  const reversed = validateStatementPeriod("custom", "2026-11-20", "2026-11-10");
  assert.equal(reversed.valid, false);
  assert.equal(reversed.error, "From date must not be after To date.");

  const missing = validateStatementPeriod("custom", "2026-11-01", "");
  assert.equal(missing.valid, false);
  assert.equal(missing.error, "Please select both From and To dates.");

  const invalidCalendar = validateStatementPeriod("custom", "2026-02-30", "2026-03-01");
  assert.equal(invalidCalendar.valid, false);
  assert.equal(invalidCalendar.error, "Please enter valid dates.");

  const ledger = buildPartyLedger({ party: SAMPLE_CLIENT });
  const stmt = buildPartyStatement({
    party: SAMPLE_CLIENT,
    ledger,
    preset: "custom",
    customFrom: "2026-11-25",
    customTo: "2026-11-10",
  });
  assert.equal(stmt.valid, false);
  assert.equal(stmt.error, "From date must not be after To date.");
});

// CHECK 12: an empty period still produces a valid statement
test("12. Empty period still builds a valid statement with brought-forward and closing balances intact", () => {
  const ledger = buildPartyLedger({
    party: {
      id: "party-empty-period",
      code: "C-900",
      name: "Quiet Period Client",
      type: "client",
      opening_balance: 2500,
      current_balance: 6500,
      created_at: "2026-09-01T00:00:00Z",
    },
    bookingInvoices: [
      {
        id: "inv-sep",
        invoice_no: "INV-SEP",
        invoice_date: "2026-09-15",
        party_id: "party-empty-period",
        client_amount: 4000,
        created_at: "2026-09-15T09:00:00Z",
      },
    ],
  });

  const emptyStmt = buildPartyStatement({
    party: {
      id: "party-empty-period",
      code: "C-900",
      name: "Quiet Period Client",
      type: "client",
      opening_balance: 2500,
      current_balance: 6500,
    },
    ledger,
    preset: "this_month",
    todayYmd: "2026-11-16",
  });

  assert.equal(emptyStmt.valid, true);
  assert.equal(emptyStmt.isEmptyPeriod, true);
  assert.equal(emptyStmt.emptyNote, "No transactions in this period");
  assert.equal(emptyStmt.entries.length, 0);
  assert.equal(emptyStmt.broughtForward, 6500);
  assert.equal(emptyStmt.totalDebit, 0);
  assert.equal(emptyStmt.totalCredit, 0);
  assert.equal(emptyStmt.closingBalance, 6500);
  assert.equal(emptyStmt.hasMismatch, false);
});

// REGRESSION 13: Undefined/loading ledger never crashes filterPartyLedgerRows or buildPartyStatement
test("13. Loading/undefined ledger safely falls back without crashing View Ledger or Send Statement", () => {
  const filtered = filterPartyLedgerRows(undefined, { datePreset: "all" });
  assert.deepEqual(filtered.rowsNewestFirst, []);
  assert.equal(filtered.totalDebit, 0);
  assert.equal(filtered.totalCredit, 0);
  assert.equal(filtered.closingBalance, 0);

  const stmt = buildPartyStatement({
    party: SAMPLE_CLIENT,
    ledger: undefined,
    preset: "this_month",
    todayYmd: "2026-11-16",
  });
  assert.equal(stmt.valid, true);
  assert.equal(stmt.broughtForward, SAMPLE_CLIENT.opening_balance);
  assert.deepEqual(stmt.entries, []);
});

