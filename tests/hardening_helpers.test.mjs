import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { toFriendlyMessage, parseFriendlyError } = await import("../src/lib/friendlyError.ts");
const {
  checkDocumentNumberAvailabilityDetailed,
  checkDocumentNumberAvailable,
} = await import("../src/lib/documentNumberAvailability.ts");
const {
  markTemplatePending,
  markTemplateSynced,
  shouldPreserveStorageKeyOnClear,
} = await import("../src/lib/templateStorageKeys.ts");
const {
  loadAgencyTemplateCore,
  saveAgencyTemplateCore,
  migrateAllLocalTemplatesCore,
} = await import("../src/lib/agencyTemplatesCore.ts");
const { getAuthCallbackUrl, getAuthRedirectUrl, resolveAuthOrigin } = await import(
  "../src/lib/authRedirect.ts"
);
const { classifyAuthCallbackFailure, getResendCooldownRemaining } = await import(
  "../src/lib/authFlowState.ts"
);
const { isLicenseExpiredWithGrace, getDaysRemaining } = await import(
  "../src/lib/licenseUtils.ts"
);

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

function createMockTemplateClient({ row = null, selectError = null, upsertError = null } = {}) {
  const upserts = [];
  return {
    upserts,
    from(table) {
      assert.equal(table, "agency_templates");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: row, error: selectError };
        },
        async upsert(payload, options) {
          upserts.push({ payload, options });
          return { data: payload, error: upsertError };
        },
      };
    },
  };
}

test("toFriendlyMessage redacts raw SQL/Postgres details and translates known errors", () => {
  const rlsMsg = toFriendlyMessage({
    code: "42501",
    message: 'new row violates row-level security policy for table "booking_invoices"',
  });
  assert.equal(rlsMsg, "You do not have permission to perform this action.");

  const rawSqlLeak = toFriendlyMessage(
    {
      code: "XX000",
      message: "ERROR: syntax error at or near SELECT in relation public.transactions",
    },
    "Could not save changes."
  );
  assert.equal(rawSqlLeak, "Could not save changes.");

  const expiredMsg = toFriendlyMessage({
    message: "Your trial or license has expired. Please renew your plan to continue.",
  });
  assert.match(expiredMsg, /Viewing and exporting remain available/i);

  const dupInvoice = parseFriendlyError({
    code: "23505",
    message: 'duplicate key value violates unique constraint "idx_booking_invoices_agency_invoice_no"',
  });
  assert.equal(dupInvoice.isDuplicate, true);
  assert.match(dupInvoice.userMessage, /invoice number already exists/i);
});

test("checkDocumentNumberAvailabilityDetailed FAILS CLOSED on RPC/network errors", async () => {
  const okResult = await checkDocumentNumberAvailabilityDetailed(
    "invoice",
    "INV-2026-0001",
    null,
    async () => ({ data: true, error: null })
  );
  assert.deepEqual(okResult, { available: true, failed: false });

  const takenResult = await checkDocumentNumberAvailabilityDetailed(
    "invoice",
    "INV-2026-0001",
    null,
    async () => ({ data: false, error: null })
  );
  assert.deepEqual(takenResult, { available: false, failed: false });

  const rpcErrResult = await checkDocumentNumberAvailabilityDetailed(
    "invoice",
    "INV-2026-0009",
    null,
    async () => ({ data: null, error: { message: "Failed to fetch" } })
  );
  assert.equal(rpcErrResult.available, false);
  assert.equal(rpcErrResult.failed, true);
  assert.ok(rpcErrResult.errorMessage);

  const thrownResult = await checkDocumentNumberAvailabilityDetailed(
    "voucher_crv",
    "CRV-2026-0001",
    null,
    async () => {
      throw new Error("ECONNREFUSED");
    }
  );
  assert.equal(thrownResult.available, false);
  assert.equal(thrownResult.failed, true);

  const boolOnErr = await checkDocumentNumberAvailable(
    "invoice",
    "INV-2026-0009",
    null,
    async () => ({ data: true, error: { message: "timeout" } })
  );
  assert.equal(boolOnErr, false);
});

test("Template storage keys protect unsynced templates across logout cleanup", () => {
  const storage = createMemoryStorage({
    invoice_template: JSON.stringify({ companyName: "Fly High" }),
    booking_template: JSON.stringify({ headerText: "Hello" }),
    tams_ui_theme: "dark",
    "sb-proj-auth-token": "token",
    cached_invoices: "[]",
  });
  const prefs = new Set(["tams_ui_theme"]);

  // Legacy template without a synced marker must NOT be wiped on logout
  assert.equal(shouldPreserveStorageKeyOnClear("invoice_template", storage, prefs), true);
  assert.equal(shouldPreserveStorageKeyOnClear("cached_invoices", storage, prefs), false);
  assert.equal(shouldPreserveStorageKeyOnClear("tams_ui_theme", storage, prefs), true);
  assert.equal(shouldPreserveStorageKeyOnClear("sb-proj-auth-token", storage, prefs), true);

  // Mark synced -> safe to clear volatile cache on logout
  markTemplateSynced(storage, "agency-1", "invoice_template");
  assert.equal(shouldPreserveStorageKeyOnClear("invoice_template", storage, prefs), false);

  // Edit again -> pending marker clears synced flag and preserves template + marker
  markTemplatePending(storage, "invoice_template");
  assert.equal(shouldPreserveStorageKeyOnClear("invoice_template", storage, prefs), true);
  assert.equal(
    shouldPreserveStorageKeyOnClear("tams_template_pending:invoice_template", storage, prefs),
    true
  );
});

test("agencyTemplatesCore prefers DB, migrates localStorage once, and survives missing table", async () => {
  const storage = createMemoryStorage({
    invoice_template: JSON.stringify({ companyName: "Local Draft" }),
    agency_logo: "data:image/png;base64,ABC",
  });

  // 1. DB has a template -> DB wins and updates local cache
  const dbClient = createMockTemplateClient({
    row: { value: { companyName: "Server Co" }, updated_at: "2026-11-15T10:00:00Z" },
  });
  const dbRes = await loadAgencyTemplateCore("invoice_template", {
    client: dbClient,
    agencyId: "agency-1",
    storage,
  });
  assert.equal(dbRes.source, "db");
  assert.equal(dbRes.data.companyName, "Server Co");
  assert.equal(JSON.parse(storage.getItem("invoice_template")).companyName, "Server Co");

  // 2. DB empty + local template -> uploads once with agency_logo enriched
  const freshStorage = createMemoryStorage({
    invoice_template: JSON.stringify({ companyName: "Migrated Co" }),
    agency_logo: "data:image/png;base64,XYZ",
  });
  const migrateClient = createMockTemplateClient({ row: null });
  await migrateAllLocalTemplatesCore({
    client: migrateClient,
    agencyId: "agency-1",
    storage: freshStorage,
  });
  assert.equal(migrateClient.upserts.length, 1);
  assert.equal(migrateClient.upserts[0].payload.key, "invoice_template");
  assert.equal(migrateClient.upserts[0].payload.value.logo, "data:image/png;base64,XYZ");
  assert.equal(shouldPreserveStorageKeyOnClear("invoice_template", freshStorage, new Set()), false);

  // 3. Pre-SQL missing table -> keeps localStorage draft without failing save
  const preSqlClient = createMockTemplateClient({
    upsertError: { code: "42P01", message: 'relation "agency_templates" does not exist' },
  });
  const preSqlSave = await saveAgencyTemplateCore(
    "booking_template",
    { showPnr: true },
    { client: preSqlClient, agencyId: "agency-1", storage: freshStorage }
  );
  assert.equal(preSqlSave.ok, true);
  assert.equal(preSqlSave.savedToDb, false);
  assert.equal(preSqlSave.missingTable, true);

  // 4. Genuine server error on save -> returns ok:false + preserves pending local draft
  const failClient = createMockTemplateClient({
    upsertError: { code: "42501", message: "row-level security policy violation" },
  });
  const failSave = await saveAgencyTemplateCore(
    "reminder_templates",
    [{ id: "1", text: "Hello" }],
    { client: failClient, agencyId: "agency-1", storage: freshStorage }
  );
  assert.equal(failSave.ok, false);
  assert.equal(failSave.savedToDb, false);
  assert.ok(failSave.errorMessage);
  assert.equal(
    shouldPreserveStorageKeyOnClear("reminder_templates", freshStorage, new Set()),
    true
  );
});

test("authRedirect & authFlowState enforce allowlisted production origins (never localhost or unallowlisted domains), cross-device PKCE message, and 60s cooldown", () => {
  assert.equal(resolveAuthOrigin("https://tamspro.online"), "https://tamspro.online");
  assert.equal(resolveAuthOrigin("https://www.tamspro.online"), "https://www.tamspro.online");
  assert.equal(resolveAuthOrigin("https://tamspro.vercel.app"), "https://tamspro.vercel.app");
  assert.equal(resolveAuthOrigin("http://localhost:5173"), "https://tamspro.online");
  assert.equal(resolveAuthOrigin("https://old-vercel.example"), "https://tamspro.online");
  assert.equal(resolveAuthOrigin("https://old-retired.example"), "https://tamspro.online");

  assert.equal(
    getAuthCallbackUrl(undefined, "https://tamspro.online"),
    "https://tamspro.online/auth/callback"
  );
  assert.equal(
    getAuthCallbackUrl(undefined, "https://tamspro.vercel.app"),
    "https://tamspro.vercel.app/auth/callback"
  );
  assert.equal(
    getAuthCallbackUrl(undefined, "http://localhost:5173"),
    "https://tamspro.online/auth/callback"
  );
  assert.equal(
    getAuthRedirectUrl("/reset-password", "http://localhost:5173"),
    "https://tamspro.online/reset-password"
  );
  assert.equal(
    getAuthRedirectUrl("/reset-password", "https://old-retired.example"),
    "https://tamspro.online/reset-password"
  );

  const pkceOutcome = classifyAuthCallbackFailure({
    errorMessage: "invalid request: both auth code and code verifier should be non-empty",
  });
  assert.equal(pkceOutcome.kind, "cross_device_confirmed");
  assert.equal(pkceOutcome.title, "Email confirmed! Please log in.");

  const expiredOutcome = classifyAuthCallbackFailure({
    errorCode: "otp_expired",
    errorDescription: "Email link is invalid or has expired",
  });
  assert.equal(expiredOutcome.kind, "expired_or_used");

  assert.equal(getResendCooldownRemaining(null, 10_000), 0);
  assert.equal(getResendCooldownRemaining(10_000, 25_500), 45);
  assert.equal(getResendCooldownRemaining(10_000, 75_000), 0);
});

test("licenseUtils mirrors server 3-day grace window and null-safe expiry rules", () => {
  const now = new Date("2026-11-15T12:00:00Z");

  // Missing / NULL expiry never blocks
  assert.equal(isLicenseExpiredWithGrace(null, now), false);
  assert.equal(isLicenseExpiredWithGrace(undefined, now), false);

  // Future expiry -> active
  assert.equal(isLicenseExpiredWithGrace("2026-11-20T12:00:00Z", now), false);
  assert.equal(getDaysRemaining("2026-11-20T12:00:00Z", now), 5);

  // Within 3-day grace window (-2 days) -> NOT expired
  assert.equal(isLicenseExpiredWithGrace("2026-11-13T12:00:00Z", now), false);

  // Past 3-day grace window (-4 days) -> expired
  assert.equal(isLicenseExpiredWithGrace("2026-11-11T12:00:00Z", now), true);
});
