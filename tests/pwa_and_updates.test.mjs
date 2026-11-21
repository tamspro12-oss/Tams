import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { compareUpdateManifest, isNewerVersion } = await import("../src/lib/versionManager.ts");
const { buildSafeRefreshUrl } = await import("../src/lib/forceRefresh.ts");
const {
  APP_NAVIGATION_CORE,
  SALES_SUB_SECTIONS_CORE,
  getDesktopSidebarItemsCore,
  getMobileBottomBarItemsCore,
  getMobileMoreItemsCore,
  isMoreMenuRouteActive,
  isNavItemActive,
  normalizeSalesTab,
} = await import("../src/config/navigationCore.ts");

test("isNewerVersion compares dotted semantic versions cleanly", () => {
  assert.equal(isNewerVersion("3.7.0", "3.6.0"), true);
  assert.equal(isNewerVersion("3.6.0", "3.5.1"), true);
  assert.equal(isNewerVersion("3.6.1", "3.6.0"), true);
  assert.equal(isNewerVersion("4.0.0", "3.9.9"), true);
  assert.equal(isNewerVersion("3.7.0", "3.7.0"), false);
  assert.equal(isNewerVersion("3.6.0", "3.7.0"), false);
});

test("compareUpdateManifest detects any newly deployed buildId or newer semver safely", () => {
  const current = { version: "3.7.0", buildId: "3.7.0-1700000000" };

  assert.equal(
    compareUpdateManifest(current, { version: "3.7.0", buildId: "3.7.0-1700000000" }),
    false
  );
  // Same semver, new bugfix buildId -> must detect update automatically
  assert.equal(
    compareUpdateManifest(current, { version: "3.7.0", buildId: "3.7.0-1700009999" }),
    true
  );
  // Higher version -> must detect update
  assert.equal(
    compareUpdateManifest(current, { version: "3.7.1", buildId: "3.7.1-1700009999" }),
    true
  );
  // Dev builds must never nag in background
  assert.equal(
    compareUpdateManifest({ version: "3.6.0", buildId: "dev" }, { version: "3.7.0", buildId: "3.7.0-1" }),
    false
  );
  // Explicit manual check compares version even on dev buildId
  assert.equal(
    compareUpdateManifest(
      { version: "3.6.0", buildId: "dev" },
      { version: "3.7.0", buildId: "3.7.0-1" },
      { manual: true }
    ),
    true
  );
  assert.equal(
    compareUpdateManifest(
      { version: "3.7.0", buildId: "dev" },
      { version: "3.7.0", buildId: "dev" },
      { manual: true }
    ),
    false
  );
  // Null or malformed manifest must return false
  assert.equal(compareUpdateManifest(current, null), false);
  assert.equal(compareUpdateManifest(current, {}), false);
});

test("buildSafeRefreshUrl preserves existing query parameters and hashes", () => {
  const out = buildSafeRefreshUrl(
    "https://tamspro.vercel.app/app/clients-vendors?tab=parties&type=vendor#top",
    123456
  );
  assert.equal(
    out,
    "https://tamspro.vercel.app/app/clients-vendors?tab=parties&type=vendor&_tams_v=123456#top"
  );

  const out2 = buildSafeRefreshUrl(out, 999999);
  assert.equal(
    out2,
    "https://tamspro.vercel.app/app/clients-vendors?tab=parties&type=vendor&_tams_v=999999#top"
  );
});

test("shared navigation config matches canonical routes and removes legacy modules", () => {
  const forbiddenPrefixes = ["/app/bookings", "/app/accounts", "/app/vouchers", "/app/vendors"];
  for (const item of APP_NAVIGATION_CORE) {
    assert.notEqual(item.label, "Vouchers Hub");
    for (const prefix of forbiddenPrefixes) {
      assert.equal(
        item.href.startsWith(prefix),
        false,
        `Navigation item "${item.id}" must not use legacy href "${item.href}"`
      );
    }
  }

  assert.deepEqual(
    SALES_SUB_SECTIONS_CORE.map((s) => ({ id: s.id, label: s.label, href: s.href })),
    [
      { id: "booking-invoice", label: "Invoice", href: "/app/sales-expenses?tab=booking-invoice" },
      { id: "payment-vouchers", label: "Voucher", href: "/app/sales-expenses?tab=payment-vouchers" },
      { id: "refunds-voids", label: "Refund", href: "/app/sales-expenses?tab=refunds-voids" },
      { id: "expenses", label: "Expense", href: "/app/sales-expenses?tab=expenses" },
    ]
  );

  assert.equal(normalizeSalesTab("voucher"), "payment-vouchers");
  assert.equal(normalizeSalesTab("invoice"), "booking-invoice");
  assert.equal(normalizeSalesTab("refund"), "refunds-voids");
  assert.equal(normalizeSalesTab("expense"), "expenses");
  assert.equal(normalizeSalesTab("unknown"), "booking-invoice");

  const moreItems = getMobileMoreItemsCore({ isAdmin: false });
  const moreById = Object.fromEntries(moreItems.map((item) => [item.id, item]));

  assert.equal(moreById["vendors-airlines"]?.href, "/app/clients-vendors?tab=parties&type=vendor");
  assert.equal(moreById["financial-reports"]?.href, "/app/reports?tab=financial-reports");
  assert.equal(moreById["b2b-agents"]?.href, "/app/b2b-agents");
  assert.equal(moreById["settings"]?.href, "/app/settings");
  assert.equal(moreById["email-integration"]?.href, "/app/settings?tab=email-integration");
  assert.equal(moreById["notifications"]?.href, "/app/notifications");
  assert.equal(moreById["umrah-calculator"]?.href, "/app/umrah-calculator");
  assert.equal(moreById["user-manual"]?.href, "/app/settings?tab=manual");
  assert.equal(moreById["admin"], undefined);

  const adminMore = getMobileMoreItemsCore({ isAdmin: true });
  assert.equal(adminMore.some((i) => i.id === "admin"), true);

  const desktopNonAdmin = getDesktopSidebarItemsCore({ isAdmin: false });
  assert.equal(desktopNonAdmin.some((i) => i.id === "b2b-agents"), true);
  assert.equal(desktopNonAdmin.some((i) => i.id === "admin"), false);

  const bottomItems = getMobileBottomBarItemsCore();
  assert.deepEqual(
    bottomItems.map((i) => i.href),
    ["/app/dashboard", "/app/sales-expenses", "/app/clients-vendors", "/app/reports"]
  );

  // Query matching for sub-tab More items
  assert.equal(
    isNavItemActive(moreById["vendors-airlines"], "/app/clients-vendors", "?tab=parties&type=vendor"),
    true
  );
  assert.equal(
    isNavItemActive(moreById["vendors-airlines"], "/app/clients-vendors", ""),
    false
  );
  assert.equal(isMoreMenuRouteActive("/app/b2b-agents", "", false), true);
  assert.equal(isMoreMenuRouteActive("/app/clients-vendors", "?tab=parties&type=vendor", false), false);
});
