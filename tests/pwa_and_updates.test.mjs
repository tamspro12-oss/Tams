import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { compareUpdateManifest, isNewerVersion } = await import("../src/lib/versionManager.ts");
const { buildSafeRefreshUrl } = await import("../src/lib/forceRefresh.ts");

test("isNewerVersion compares dotted semantic versions cleanly", () => {
  assert.equal(isNewerVersion("3.6.0", "3.5.1"), true);
  assert.equal(isNewerVersion("3.6.1", "3.6.0"), true);
  assert.equal(isNewerVersion("4.0.0", "3.9.9"), true);
  assert.equal(isNewerVersion("3.6.0", "3.6.0"), false);
  assert.equal(isNewerVersion("3.5.9", "3.6.0"), false);
});

test("compareUpdateManifest detects any newly deployed buildId or newer semver safely", () => {
  const current = { version: "3.6.0", buildId: "3.6.0-1700000000" };

  assert.equal(
    compareUpdateManifest(current, { version: "3.6.0", buildId: "3.6.0-1700000000" }),
    false
  );
  // Same semver, new bugfix buildId -> must detect update automatically
  assert.equal(
    compareUpdateManifest(current, { version: "3.6.0", buildId: "3.6.0-1700009999" }),
    true
  );
  // Higher version -> must detect update
  assert.equal(
    compareUpdateManifest(current, { version: "3.6.1", buildId: "3.6.1-1700009999" }),
    true
  );
  // Dev builds must never nag
  assert.equal(
    compareUpdateManifest({ version: "3.6.0", buildId: "dev" }, { version: "3.6.1", buildId: "3.6.1-1" }),
    false
  );
  // Null or malformed manifest must return false
  assert.equal(compareUpdateManifest(current, null), false);
  assert.equal(compareUpdateManifest(current, {}), false);
});

test("buildSafeRefreshUrl preserves existing query parameters and hashes", () => {
  const out = buildSafeRefreshUrl("https://tamspro.vercel.app/app/bookings?tab=b2b-agents#top", 123456);
  assert.equal(
    out,
    "https://tamspro.vercel.app/app/bookings?tab=b2b-agents&_tams_v=123456#top"
  );

  const out2 = buildSafeRefreshUrl(out, 999999);
  assert.equal(
    out2,
    "https://tamspro.vercel.app/app/bookings?tab=b2b-agents&_tams_v=999999#top"
  );
});

