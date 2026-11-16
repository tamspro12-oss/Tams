import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const {
  classifyFormKeyAction,
  sortVisualEntries,
  resolveAdjacentIndex,
} = await import("../src/lib/formKeyboardNavCore.ts");

const {
  DEFAULT_SLOW_SAVE_WARNING_MS,
  DEFAULT_SAVE_TIMEOUT_MS,
  createRequestId,
  isMissingRpcOrParamError,
  runAtomicSave,
  rpcWithPreSqlFallback,
  runBackgroundTask,
} = await import("../src/lib/atomicSave.ts");

const {
  GLOBAL_SEARCH_MIN_CHARS,
  GLOBAL_SEARCH_PAGE_SIZE,
  GLOBAL_SEARCH_DEBOUNCE_MS,
  normalizeGlobalSearchQuery,
  shouldTriggerGlobalSearch,
  sortInvoicesNewestFirst,
  sortVouchersNewestFirst,
  mergeGlobalSearchPage,
} = await import("../src/lib/globalSearchCore.ts");

test("Keyboard helper: never calls preventDefault on Tab or Shift+Tab across all control types", () => {
  const controlContexts = [
    { tagName: "INPUT" },
    { tagName: "INPUT", role: null },
    { tagName: "SELECT" },
    { tagName: "BUTTON", role: "combobox" },
    { tagName: "TEXTAREA" },
    { tagName: "BUTTON", isSkipEnterButton: true },
  ];

  for (const ctx of controlContexts) {
    const forward = classifyFormKeyAction({ key: "Tab", shiftKey: false }, ctx);
    assert.equal(forward.action, "native");
    assert.equal(forward.shouldPreventDefault, false);

    const backward = classifyFormKeyAction({ key: "Tab", shiftKey: true }, ctx);
    assert.equal(backward.action, "native");
    assert.equal(backward.shouldPreventDefault, false);
  }
});

test("Keyboard helper: Enter advances, Shift+Enter goes backward, Ctrl+Enter adds passenger or saves", () => {
  // Normal input Enter -> next
  assert.deepEqual(classifyFormKeyAction({ key: "Enter" }, { tagName: "INPUT" }), {
    action: "next",
    shouldPreventDefault: true,
  });

  // Shift+Enter -> previous from input, combobox, select, date input, textarea
  for (const ctx of [
    { tagName: "INPUT" },
    { tagName: "SELECT" },
    { tagName: "BUTTON", role: "combobox" },
    { tagName: "TEXTAREA" },
    { tagName: "BUTTON", isSkipEnterButton: true },
  ]) {
    assert.deepEqual(
      classifyFormKeyAction({ key: "Enter", shiftKey: true }, ctx),
      { action: "prev", shouldPreventDefault: true }
    );
  }

  // Enter on Textarea adds newline (passthrough); Enter on combobox opens natively
  assert.deepEqual(classifyFormKeyAction({ key: "Enter" }, { tagName: "TEXTAREA" }), {
    action: "passthrough",
    shouldPreventDefault: false,
  });
  assert.deepEqual(
    classifyFormKeyAction({ key: "Enter" }, { tagName: "BUTTON", role: "combobox" }),
    { action: "passthrough", shouldPreventDefault: false }
  );

  // Open popup lets listbox/popover handle Enter natively
  assert.deepEqual(
    classifyFormKeyAction({ key: "Enter" }, { tagName: "INPUT", isInsideOpenPopup: true }),
    { action: "passthrough", shouldPreventDefault: false }
  );

  // Ctrl+Enter inside repeatable passenger row -> add_passenger; outside -> save
  assert.deepEqual(
    classifyFormKeyAction(
      { key: "Enter", ctrlKey: true },
      { tagName: "INPUT", hasRepeatableRow: true }
    ),
    { action: "add_passenger", shouldPreventDefault: true }
  );
  assert.deepEqual(
    classifyFormKeyAction(
      { key: "Enter", ctrlKey: true },
      { tagName: "INPUT", hasRepeatableRow: false }
    ),
    { action: "save", shouldPreventDefault: true }
  );

  // Ctrl+Shift+Enter with Save & Add Next -> save_and_next
  assert.deepEqual(
    classifyFormKeyAction(
      { key: "Enter", ctrlKey: true, shiftKey: true },
      { tagName: "INPUT", hasSaveAndAddNext: true }
    ),
    { action: "save_and_next", shouldPreventDefault: true }
  );
});

test("Keyboard helper: visual order sorting and non-trapping adjacent index resolution", () => {
  const ordered = sortVisualEntries([
    { item: "amount", domIndex: 2, top: 80, left: 300 },
    { item: "party", domIndex: 0, top: 20, left: 400 },
    { item: "date", domIndex: 1, top: 20, left: 40 },
    { item: "mode", domIndex: 3, top: 80, left: 40 },
  ]);
  assert.deepEqual(ordered, ["date", "party", "mode", "amount"]);

  assert.equal(resolveAdjacentIndex(0, 4, "next"), 1);
  assert.equal(resolveAdjacentIndex(3, 4, "next"), -1); // never traps at end
  assert.equal(resolveAdjacentIndex(2, 4, "prev"), 1);
  assert.equal(resolveAdjacentIndex(0, 4, "prev"), -1); // never traps at start
});

test("Single-save runner: exposes 15s slow warning & 30s timeout defaults and closes cleanly once", async () => {
  assert.equal(DEFAULT_SLOW_SAVE_WARNING_MS, 15_000);
  assert.equal(DEFAULT_SAVE_TIMEOUT_MS, 30_000);

  let locked = false;
  let serverCalls = 0;
  let successCalls = 0;
  let capturedReqId = "";

  const reqId = createRequestId();
  const res = await runAtomicSave({
    requestId: reqId,
    isLocked: () => locked,
    setLocked: (v) => {
      locked = v;
    },
    execute: async (id) => {
      serverCalls++;
      capturedReqId = id;
      assert.equal(locked, true);
      return { invoice_no: "INV-0001" };
    },
    onSuccess: (data) => {
      successCalls++;
      assert.equal(data.invoice_no, "INV-0001");
    },
  });

  assert.equal(res.ok, true);
  assert.equal(serverCalls, 1);
  assert.equal(successCalls, 1);
  assert.equal(capturedReqId, reqId);
  assert.equal(locked, false);
});

test("Single-save runner: prevents double-submit while saving", async () => {
  let locked = true;
  let calls = 0;

  const res = await runAtomicSave({
    isLocked: () => locked,
    setLocked: (v) => {
      locked = v;
    },
    execute: async () => {
      calls++;
      return { ok: true };
    },
  });

  assert.equal(res.ok, false);
  assert.equal(res.skippedLocked, true);
  assert.equal(calls, 0);
});

test("Single-save runner: slow server fires slow warning at threshold and resolves safely", async () => {
  let slowWarned = false;
  let closed = false;
  let locked = false;

  const res = await runAtomicSave({
    slowWarningMs: 15,
    timeoutMs: 250,
    isLocked: () => locked,
    setLocked: (v) => {
      locked = v;
    },
    onSlowWarning: () => {
      slowWarned = true;
    },
    execute: async () => {
      await new Promise((r) => setTimeout(r, 45));
      return { saved: true };
    },
    onSuccess: () => {
      closed = true;
    },
  });

  assert.equal(res.ok, true);
  assert.equal(slowWarned, true);
  assert.equal(closed, true);
  assert.equal(locked, false);
});

test("Single-save runner: timeout never claims saved, keeps requestId for duplicate-free retry", async () => {
  let locked = false;
  let closed = false;
  let errMessage = "";
  let timedOutFlag = false;
  const stableId = createRequestId();

  const timeoutRes = await runAtomicSave({
    requestId: stableId,
    slowWarningMs: 10,
    timeoutMs: 30,
    isLocked: () => locked,
    setLocked: (v) => {
      locked = v;
    },
    execute: async () => {
      await new Promise((r) => setTimeout(r, 90));
      return { saved: true };
    },
    onSuccess: () => {
      closed = true;
    },
    onError: (msg, info) => {
      errMessage = msg;
      timedOutFlag = info.timedOut;
    },
  });

  assert.equal(timeoutRes.ok, false);
  assert.equal(timeoutRes.timedOut, true);
  assert.equal(timedOutFlag, true);
  assert.equal(closed, false); // Form remains open!
  assert.equal(locked, false); // Unlocked so user can safely retry
  assert.equal(timeoutRes.requestId, stableId);
  assert.match(errMessage, /timed out|try again|retry/i);

  // Retry reuses identical requestId -> idempotent save succeeds on second attempt
  let retryReceivedReqId = "";
  const retryRes = await runAtomicSave({
    requestId: timeoutRes.requestId,
    isLocked: () => locked,
    setLocked: (v) => {
      locked = v;
    },
    execute: async (id) => {
      retryReceivedReqId = id;
      return { id: "row-1" };
    },
    onSuccess: () => {
      closed = true;
    },
  });

  assert.equal(retryRes.ok, true);
  assert.equal(retryReceivedReqId, stableId);
  assert.equal(closed, true);
});

test("Single-save runner: server failure shows friendly message, hides raw SQL, never calls onSuccess", async () => {
  let closed = false;
  let friendlyOut = "";
  let locked = false;

  const res = await runAtomicSave({
    isLocked: () => locked,
    setLocked: (v) => {
      locked = v;
    },
    fallbackErrorMessage: "Could not save record. Please try again.",
    execute: async () => {
      throw {
        code: "42501",
        message: 'new row violates row-level security policy on table "booking_invoices" SELECT * FROM sub_users',
      };
    },
    onSuccess: () => {
      closed = true;
    },
    onError: (msg) => {
      friendlyOut = msg;
    },
  });

  assert.equal(res.ok, false);
  assert.equal(closed, false);
  assert.equal(locked, false);
  assert.equal(friendlyOut, "You do not have permission to perform this action.");
  assert.equal(friendlyOut.includes("SELECT"), false);
  assert.equal(friendlyOut.includes("booking_invoices"), false);
});

test("Single-save runner: offline check blocks request cleanly without fake saved state", async () => {
  let executed = false;
  let closed = false;
  let errOut = "";

  const res = await runAtomicSave({
    isOnline: () => false,
    execute: async () => {
      executed = true;
      return { ok: true };
    },
    onSuccess: () => {
      closed = true;
    },
    onError: (msg) => {
      errOut = msg;
    },
  });

  assert.equal(res.ok, false);
  assert.equal(res.offline, true);
  assert.equal(executed, false);
  assert.equal(closed, false);
  assert.match(errOut, /offline/i);
});

test("Pre-SQL RPC fallback: transparently falls back when p_request_id or RPC is not yet deployed", async () => {
  const rpcCalls = [];
  const client = {
    async rpc(fn, params) {
      rpcCalls.push({ fn, params });
      if ("p_request_id" in (params || {})) {
        return {
          data: null,
          error: {
            code: "PGRST202",
            message: "Could not find the function public.save_booking_invoice_atomic(p_request_id) in the schema cache",
          },
        };
      }
      return { data: { success: true, invoice_no: "INV-0099" }, error: null };
    },
  };

  assert.equal(
    isMissingRpcOrParamError({
      code: "PGRST202",
      message: "Could not find the function in the schema cache",
    }),
    true
  );

  const result = await rpcWithPreSqlFallback(
    client,
    "save_booking_invoice_atomic",
    { p_service: "Ticket", p_request_id: "uuid-1" },
    { isAutoMode: true }
  );

  assert.equal(rpcCalls.length, 2);
  assert.equal(result.invoice_no, "INV-0099");

  // Non-blocking background task never fails even if callback rejects
  let ran = false;
  runBackgroundTask("test-bg", async () => {
    ran = true;
    throw new Error("Non-critical side task failed");
  });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(ran, true);
});

test("Global search helpers: 2-char gate, debounce constant, newest-first ordering, show-more merge", () => {
  assert.equal(GLOBAL_SEARCH_MIN_CHARS, 2);
  assert.equal(GLOBAL_SEARCH_PAGE_SIZE, 50);
  assert.equal(GLOBAL_SEARCH_DEBOUNCE_MS, 300);

  assert.equal(shouldTriggerGlobalSearch(""), false);
  assert.equal(shouldTriggerGlobalSearch(" a "), false);
  assert.equal(shouldTriggerGlobalSearch("ab"), true);
  assert.equal(normalizeGlobalSearchQuery("  Ali   Khan\t "), "Ali Khan");

  const sortedInv = sortInvoicesNewestFirst([
    { id: "old", invoice_date: "2026-01-10", created_at: "2026-01-10T10:00:00Z" },
    { id: "newest", invoice_date: "2026-05-01", created_at: "2026-05-01T12:00:00Z" },
    { id: "same-day-older", invoice_date: "2026-05-01", created_at: "2026-05-01T08:00:00Z" },
  ]);
  assert.deepEqual(
    sortedInv.map((x) => x.id),
    ["newest", "same-day-older", "old"]
  );

  const sortedVch = sortVouchersNewestFirst([
    { id: "v1", voucher_date: "2026-02-01", created_at: "2026-02-01T09:00:00Z" },
    { id: "v2", voucher_date: "2026-06-15", created_at: "2026-06-15T09:00:00Z" },
  ]);
  assert.deepEqual(
    sortedVch.map((x) => x.id),
    ["v2", "v1"]
  );

  const page1 = {
    query: "ali",
    limit: 50,
    offset: 0,
    parties: [{ id: "p1", name: "Ali", type: "client" }],
    invoices: [sortedInv[0], sortedInv[2]],
    vouchers: [sortedVch[0]],
    has_more: true,
    parties_has_more: false,
    invoices_has_more: true,
    vouchers_has_more: false,
  };
  const page2 = {
    query: "ali",
    limit: 50,
    offset: 50,
    parties: [{ id: "p1", name: "Ali", type: "client" }],
    invoices: [sortedInv[1], { id: "older-p2", invoice_date: "2025-12-01", created_at: "2025-12-01T00:00:00Z", invoice_no: "INV-1", total: 100, paid: 0, remaining: 100 }],
    vouchers: [sortedVch[1]],
    has_more: false,
    parties_has_more: false,
    invoices_has_more: false,
    vouchers_has_more: false,
  };

  const merged = mergeGlobalSearchPage(page1, page2);
  assert.equal(merged.parties.length, 1);
  assert.deepEqual(
    merged.invoices.map((i) => i.id),
    ["newest", "same-day-older", "old", "older-p2"]
  );
  assert.deepEqual(
    merged.vouchers.map((v) => v.id),
    ["v2", "v1"]
  );
});

test("Measured save orchestration benchmark: single-save closes well under 1s vs sequential blocking pattern", async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const simRpcMs = 180;
  const simRefetchMs = 350;

  // Before pattern: pre-check + main write + secondary write + awaited full cache refetch before closing
  const beforeStart = performance.now();
  await sleep(simRpcMs); // pre-save number check
  await sleep(simRpcMs); // main insert/RPC
  await sleep(simRpcMs); // ledger/balance write
  await sleep(simRefetchMs); // awaited 40-prefix invalidateAllFinancialQueries
  const beforeCloseMs = Math.round(performance.now() - beforeStart);

  // After pattern: 1 atomic RPC -> immediate close -> background refresh
  let formClosedAt = 0;
  let backgroundFinished = false;
  const afterStart = performance.now();
  await runAtomicSave({
    execute: async () => {
      await sleep(simRpcMs);
      return { id: "saved-1" };
    },
    onSuccess: () => {
      formClosedAt = Math.round(performance.now() - afterStart);
      runBackgroundTask("bench-refresh", async () => {
        await sleep(simRefetchMs);
        backgroundFinished = true;
      });
    },
  });

  console.log(
    `[BENCHMARK] Close time Before (sequential + blocking refetch): ${beforeCloseMs}ms | After (1 RPC + immediate close): ${formClosedAt}ms`
  );
  assert.ok(beforeCloseMs >= 800, `Expected beforeCloseMs >= 800ms, got ${beforeCloseMs}ms`);
  assert.ok(formClosedAt < 500, `Expected form close under 500ms, got ${formClosedAt}ms`);
  assert.equal(backgroundFinished, false); // Background refresh did not block form close!

  await sleep(simRefetchMs + 30);
  assert.equal(backgroundFinished, true);
});

