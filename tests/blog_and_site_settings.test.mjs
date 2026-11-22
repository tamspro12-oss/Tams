import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const {
  generateBlogSlug,
  formatBlogDate,
  estimateReadMinutes,
  normalizeTags,
  parseTagsInput,
} = await import("../src/lib/blogs.ts");

const {
  isSafeUrl,
  sanitizeHtmlString,
  renderSafeBlogContent,
  stripHtmlToText,
} = await import("../src/lib/blogSanitizer.ts");

const {
  mergeSiteSettings,
  DEFAULT_LANDING_HERO,
  DEFAULT_PRICING_SETTINGS,
} = await import("../src/lib/siteSettings.ts");

const { MARKETING_NAVIGATION } = await import("../src/config/marketingContent.ts");
const { buildSitemapXml } = await import("../api/sitemap.js");

test("generateBlogSlug, normalizeTags, parseTagsInput, formatBlogDate, estimateReadMinutes work accurately", () => {
  assert.equal(
    generateBlogSlug("  How to Manage Umrah & Visa Bookings in 2026! "),
    "how-to-manage-umrah-visa-bookings-in-2026"
  );
  assert.equal(generateBlogSlug("---Multiple   Spaces---"), "multiple-spaces");
  assert.equal(generateBlogSlug("!!!"), "");

  assert.deepEqual(normalizeTags(["Umrah", " umrah ", "Visa", "", "Billing"]), [
    "Umrah",
    "Visa",
    "Billing",
  ]);
  assert.deepEqual(parseTagsInput(" Umrah, Accounting, umrah , Invoices "), [
    "Umrah",
    "Accounting",
    "Invoices",
  ]);

  assert.equal(formatBlogDate(null), "");
  assert.equal(formatBlogDate("invalid-date"), "");
  assert.match(formatBlogDate("2026-11-22T10:00:00.000Z"), /Nov\s+22,\s+2026/);

  assert.equal(estimateReadMinutes(""), 1);
  assert.equal(estimateReadMinutes(`<p>${"word ".repeat(450)}</p>`), 3);
  assert.equal(stripHtmlToText("<h2>Hello</h2><p>World &amp; Agency</p>"), "Hello World & Agency");
});

test("isSafeUrl and renderSafeBlogContent sanitize rich HTML & Markdown safely", () => {
  assert.equal(isSafeUrl("https://tamspro.online/pricing"), true);
  assert.equal(isSafeUrl("/blogs/welcome"), true);
  assert.equal(isSafeUrl("mailto:tamspro12@gmail.com", { allowMailto: true }), true);
  assert.equal(isSafeUrl("javascript:alert(1)"), false);
  assert.equal(isSafeUrl("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeUrl("//evil.example.com"), false);

  const dirtyRichHtml = `
    <h2>Agency Guide</h2>
    <script>alert('xss')</script>
    <p onclick="alert(1)" style="color:red">Track <strong>bookings</strong> easily.</p>
    <img src="javascript:alert(1)" onerror="alert(2)" />
    <img src="https://example.com/ok.png" onerror="alert(3)" alt="Guide" />
    <a href="https://tamspro.online/pricing" onclick="steal()">View Pricing</a>
    <iframe src="https://evil.example.com"></iframe>
  `;

  const sanitized = sanitizeHtmlString(dirtyRichHtml);
  assert.doesNotMatch(sanitized, /<script/i);
  assert.doesNotMatch(sanitized, /<iframe/i);
  assert.doesNotMatch(sanitized, /onclick/i);
  assert.doesNotMatch(sanitized, /onerror/i);
  assert.doesNotMatch(sanitized, /javascript:/i);
  assert.doesNotMatch(sanitized, /style=/i);

  assert.match(sanitized, /<h2>Agency Guide<\/h2>/);
  assert.match(sanitized, /<strong>bookings<\/strong>/);
  assert.match(
    sanitized,
    /<img src="https:\/\/example\.com\/ok\.png" alt="Guide" loading="lazy" \/>/
  );
  assert.match(
    sanitized,
    /<a href="https:\/\/tamspro\.online\/pricing" target="_blank" rel="noopener noreferrer">View Pricing<\/a>/
  );

  const markdownInput = "## Steps\n\n- First item\n- Second item\n\n> Tip for agencies.";
  const renderedMd = renderSafeBlogContent(markdownInput);
  assert.match(renderedMd, /<h2>Steps<\/h2>/);
  assert.match(renderedMd, /<ul><li>First item<\/li><li>Second item<\/li><\/ul>/);
  assert.match(renderedMd, /<blockquote><p>Tip for agencies\.<\/p><\/blockquote>/);
});

test("mergeSiteSettings applies DB overrides safely over defaults", () => {
  const defaults = mergeSiteSettings([]);
  assert.equal(defaults.hero.heading, DEFAULT_LANDING_HERO.heading);
  assert.equal(defaults.pricing.plans.length, DEFAULT_PRICING_SETTINGS.plans.length);

  const merged = mergeSiteSettings([
    {
      key: "landing_hero",
      value: {
        heading: "Modern Travel Software",
        subtitle: "",
      },
    },
    {
      key: "pricing_plans",
      value: {
        heading: "Flexible Agency Plans",
        plans: [
          {
            id: "monthly",
            name: "Starter Monthly",
            priceFormatted: "PKR 1,200",
            originalPriceFormatted: "2,400",
            discountBadge: "50% OFF",
            period: "/ month",
            bullets: ["Bookings", "Vouchers"],
          },
        ],
      },
    },
  ]);

  assert.equal(merged.hero.heading, "Modern Travel Software");
  assert.equal(merged.hero.subtitle, DEFAULT_LANDING_HERO.subtitle);
  assert.equal(merged.pricing.heading, "Flexible Agency Plans");
  assert.equal(merged.pricing.plans[0].name, "Starter Monthly");
  assert.equal(merged.pricing.plans[0].priceFormatted, "PKR 1,200");
  assert.deepEqual(merged.pricing.plans[0].bullets, ["Bookings", "Vouchers"]);
  assert.equal(merged.pricing.plans[1].name, DEFAULT_PRICING_SETTINGS.plans[1].name);
});

test("buildSitemapXml includes /blogs and published post slugs", () => {
  const xml = buildSitemapXml([
    { slug: "umrah-guide-2026", updated_at: "2026-11-22T10:00:00.000Z" },
    { slug: "umrah-guide-2026", updated_at: "2026-11-22T10:00:00.000Z" },
    { slug: "agency-accounting-tips", published_at: "2026-11-21T08:00:00.000Z" },
  ]);

  assert.match(xml, /<loc>https:\/\/tamspro\.online\/blogs<\/loc>/);
  assert.match(xml, /<loc>https:\/\/tamspro\.online\/blogs\/umrah-guide-2026<\/loc>/);
  assert.match(xml, /<loc>https:\/\/tamspro\.online\/blogs\/agency-accounting-tips<\/loc>/);
  assert.equal(
    (xml.match(/umrah-guide-2026/g) || []).length,
    1,
    "Duplicate slugs should be deduplicated in sitemap"
  );
});

test("Navigation, routing, and Supabase migration guardrails stay intact", () => {
  assert.deepEqual(
    MARKETING_NAVIGATION.mainNav.map((item) => item.label),
    ["Home", "Features", "Pricing", "Blogs", "Contact"]
  );
  assert.equal(
    MARKETING_NAVIGATION.footerLinks.some((item) => item.href === "/blogs"),
    true
  );

  const appSource = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");
  assert.match(appSource, /path="\/blogs"/);
  assert.match(appSource, /path="\/blogs\/:slug"/);

  const migrationSql = fs.readFileSync(
    path.resolve("supabase/migrations/20261122140000_blogs_and_site_settings.sql"),
    "utf8"
  );
  assert.match(migrationSql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migrationSql, /blog-images/);
  assert.match(migrationSql, /public\.site_settings/);
  assert.match(migrationSql, /super_admin/);
});

