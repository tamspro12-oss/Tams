import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const {
  generateBlogSlug,
  formatBlogDate,
  estimateReadMinutes,
  getPostReadMinutes,
  normalizeTags,
  parseTagsInput,
  normalizeBlogLegacyText,
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
const { injectBlogSeoIntoHtml } = await import("../api/blog-seo.js");
const { ALL_SEO_BLOG_POSTS, validateSeoPosts } = await import(
  "../scripts/generate-blog-assets.mjs"
);

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
  assert.equal(
    getPostReadMinutes({ read_time_minutes: 7, content: "<p>short</p>" }),
    7
  );
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
  // Monthly plan must NEVER carry a discount badge or strikethrough original price
  assert.equal(merged.pricing.plans[0].discountBadge, "");
  assert.equal(merged.pricing.plans[0].originalPriceFormatted, "");
  assert.deepEqual(merged.pricing.plans[0].bullets, ["Bookings", "Vouchers"]);
  assert.equal(merged.pricing.plans[1].name, DEFAULT_PRICING_SETTINGS.plans[1].name);
  assert.equal(merged.pricing.plans[1].priceFormatted, "PKR 9,999");
  assert.equal(merged.pricing.plans[1].originalPriceFormatted, "19,999");
  assert.equal(merged.pricing.plans[1].discountBadge, "50% OFF");
  assert.equal(merged.pricing.plans[1].popular, true);
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
  assert.doesNotMatch(xml, /\/auth<\/loc>/);
  assert.doesNotMatch(xml, /\/reset-password<\/loc>/);
  assert.doesNotMatch(xml, /\/subscription-expired<\/loc>/);
  assert.doesNotMatch(xml, /\/login<\/loc>/);
  assert.equal(
    (xml.match(/umrah-guide-2026/g) || []).length,
    1,
    "Duplicate slugs should be deduplicated in sitemap"
  );
});

test("index.html and blog SSR SEO injector preserve Google verification and emit full article metadata", () => {
  const indexHtml = fs.readFileSync(path.resolve("index.html"), "utf8");
  assert.match(
    indexHtml,
    /<meta name="google-site-verification" content="8-kWgmM6MkjojqsReBo0VOb3KbVz7dSJAl_GB788rVY" \/>/
  );
  assert.match(
    indexHtml,
    /<meta name="google-site-verification" content="nASTYQhi5TfLw81mBKhge8XKryjIcvWSrrZGymUL0Uo" \/>/
  );
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/tamspro\.online\/" \/>/);
  assert.match(indexHtml, /SoftwareApplication/);

  const post = ALL_SEO_BLOG_POSTS[0];
  const injected = injectBlogSeoIntoHtml(indexHtml, {
    ...post,
    seo_title: post.title,
    seo_description: post.excerpt,
    content: `${post.content}<script>alert(1)</script>`,
    cover_image_url: `/blog-covers/${post.slug}.svg`,
  });

  assert.match(
    injected,
    new RegExp(`<title>${post.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\| TAMS Pro Blog</title>`)
  );
  assert.match(
    injected,
    new RegExp(`<link rel="canonical" href="https://tamspro\\.online/blogs/${post.slug}" />`)
  );
  assert.match(injected, /<meta property="og:type" content="article" \/>/);
  assert.match(injected, /https:\/\/tamspro\.online\/logo\.png/);
  assert.match(injected, /"@type":"Article"/);
  assert.match(injected, /"@type":"BreadcrumbList"/);
  assert.match(injected, /"@type":"FAQPage"/);
  assert.doesNotMatch(injected, /"@type":"SoftwareApplication"/);
  assert.match(injected, /<noscript><main><article><h1>/);
  assert.doesNotMatch(injected, /<script>alert\(1\)<\/script>/);
  assert.match(
    injected,
    /<meta name="google-site-verification" content="8-kWgmM6MkjojqsReBo0VOb3KbVz7dSJAl_GB788rVY" \/>/
  );
  assert.match(
    injected,
    /<meta name="google-site-verification" content="nASTYQhi5TfLw81mBKhge8XKryjIcvWSrrZGymUL0Uo" \/>/
  );
});

test("All 10 SEO blog posts, cover SVGs, migration SQL, and marketing docs pass strict quality rules", () => {
  const errors = validateSeoPosts(ALL_SEO_BLOG_POSTS);
  assert.deepEqual(errors, [], `SEO blog validation errors:\n${errors.join("\n")}`);

  for (const post of ALL_SEO_BLOG_POSTS) {
    const coverPath = path.resolve("public/blog-covers", `${post.slug}.svg`);
    assert.equal(fs.existsSync(coverPath), true, `Missing SVG cover for ${post.slug}`);
  }

  const seoMigration = fs.readFileSync(
    path.resolve("supabase/migrations/20261122150000_blog_seo_fields_and_10_posts.sql"),
    "utf8"
  );
  assert.match(seoMigration, /public\.blog_leads/);
  assert.match(seoMigration, /faq_items/);
  for (const post of ALL_SEO_BLOG_POSTS) {
    assert.match(seoMigration, new RegExp(post.slug));
  }

  const captionsDoc = fs.readFileSync(path.resolve("docs/social-captions.md"), "utf8");
  assert.match(captionsDoc, /#TravelAgencyPakistan/);
  assert.match(captionsDoc, /#UmrahPackages/);
  assert.match(captionsDoc, /#TAMSPro/);

  const seoPlanDoc = fs.readFileSync(path.resolve("docs/seo-plan.md"), "utf8");
  assert.match(seoPlanDoc, /Google Search Console/);
  assert.match(seoPlanDoc, /Google Business Profile/);
  assert.match(seoPlanDoc, /sitemap\.xml/);
});

test("Navigation, routing, pricing rules, umrahcal removal, and Supabase migration guardrails stay intact", () => {
  assert.deepEqual(
    MARKETING_NAVIGATION.mainNav.map((item) => item.label),
    ["Home", "Features", "Pricing", "Blogs", "FAQ", "About", "Contact"]
  );
  assert.equal(
    MARKETING_NAVIGATION.footerLinks.some((item) => item.href === "/blogs"),
    true
  );
  assert.equal(
    MARKETING_NAVIGATION.footerLinks.some((item) => item.href === "/refund-policy"),
    true
  );
  assert.equal(
    MARKETING_NAVIGATION.footerLinks.some((item) => item.href === "/faq"),
    true
  );
  assert.equal(
    MARKETING_NAVIGATION.footerLinks.some((item) => item.href === "/about"),
    true
  );

  // Task 0 default pricing invariants
  const [monthlyPlan, yearlyPlan] = DEFAULT_PRICING_SETTINGS.plans;
  assert.equal(monthlyPlan.id, "monthly");
  assert.equal(monthlyPlan.priceFormatted, "PKR 1,999");
  assert.equal(monthlyPlan.originalPriceFormatted, "");
  assert.equal(monthlyPlan.discountBadge, "");
  assert.equal(yearlyPlan.id, "yearly");
  assert.equal(yearlyPlan.priceFormatted, "PKR 9,999");
  assert.equal(yearlyPlan.originalPriceFormatted, "19,999");
  assert.equal(yearlyPlan.discountBadge, "50% OFF");
  assert.equal(yearlyPlan.popular, true);

  // Task 3 umrahcal.online absence across all 10 blog posts + runtime legacy normalizer
  for (const post of ALL_SEO_BLOG_POSTS) {
    assert.doesNotMatch(post.content, /umrahcal\.online/i);
    assert.doesNotMatch(post.excerpt, /umrahcal\.online/i);
    assert.doesNotMatch(post.content, /PKR\s*999/i);
  }
  const normalizedLegacy = normalizeBlogLegacyText(
    '<p>Try <a href="https://umrahcal.online/">umrahcal.online</a> and plans at PKR 999/month (50% off).</p>'
  );
  assert.doesNotMatch(normalizedLegacy, /umrahcal\.online/i);
  assert.doesNotMatch(normalizedLegacy, /PKR\s*999/i);
  assert.match(normalizedLegacy, /PKR 1,999\/month/);

  const sitemapXml = buildSitemapXml([]);
  assert.match(sitemapXml, /<loc>https:\/\/tamspro\.online\/about<\/loc>/);
  assert.match(sitemapXml, /<loc>https:\/\/tamspro\.online\/faq<\/loc>/);
  assert.match(sitemapXml, /<loc>https:\/\/tamspro\.online\/refund-policy<\/loc>/);

  const appSource = fs.readFileSync(path.resolve("src/App.tsx"), "utf8");
  assert.match(appSource, /path="\/blogs"/);
  assert.match(appSource, /path="\/blogs\/:slug"/);
  assert.match(appSource, /path="\/about"/);
  assert.match(appSource, /path="\/faq"/);
  assert.match(appSource, /path="\/refund-policy"/);
  assert.match(appSource, /path="\/reset-password"/);

  const migrationSql = fs.readFileSync(
    path.resolve("supabase/migrations/20261122140000_blogs_and_site_settings.sql"),
    "utf8"
  );
  assert.match(migrationSql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migrationSql, /blog-images/);
  assert.match(migrationSql, /public\.site_settings/);
  assert.match(migrationSql, /super_admin/);
});
