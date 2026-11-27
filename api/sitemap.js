const PRODUCTION_ORIGIN = "https://tamspro.online";
const DEFAULT_LASTMOD = "2026-11-27";

const FALLBACK_SUPABASE_URL = "https://mwpbschzwjxeioyrzskv.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_0sFy40NHfnRGnNz07iOF7g_lRqo6_hf";

const STATIC_SITEMAP_ENTRIES = [
  { path: "/", changefreq: "weekly", priority: "1.0", lastmod: DEFAULT_LASTMOD },
  { path: "/features", changefreq: "monthly", priority: "0.8", lastmod: DEFAULT_LASTMOD },
  { path: "/pricing", changefreq: "monthly", priority: "0.8", lastmod: DEFAULT_LASTMOD },
  { path: "/blogs", changefreq: "daily", priority: "0.9", lastmod: DEFAULT_LASTMOD },
  { path: "/about", changefreq: "monthly", priority: "0.7", lastmod: DEFAULT_LASTMOD },
  { path: "/faq", changefreq: "monthly", priority: "0.7", lastmod: DEFAULT_LASTMOD },
  { path: "/contact", changefreq: "monthly", priority: "0.6", lastmod: DEFAULT_LASTMOD },
  { path: "/install", changefreq: "monthly", priority: "0.5", lastmod: DEFAULT_LASTMOD },
  { path: "/privacy", changefreq: "yearly", priority: "0.3", lastmod: DEFAULT_LASTMOD },
  { path: "/terms", changefreq: "yearly", priority: "0.3", lastmod: DEFAULT_LASTMOD },
  { path: "/refund-policy", changefreq: "yearly", priority: "0.3", lastmod: DEFAULT_LASTMOD },
];

export const BUILTIN_SITEMAP_BLOG_POSTS = [
  { slug: "best-travel-agency-management-software-pakistan", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "umrah-agency-software-pakistan-bookings-vouchers-invoices-ledgers", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "airline-ticketing-software-pakistani-travel-agents", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "how-to-manage-client-and-vendor-ledgers-travel-agency", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "tams-pro-vs-spreadsheets-and-paper-registers", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "tams-pro-features-and-pricing-explained", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "best-travel-agency-software-pakistan-2026", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "manage-umrah-packages-digitally-pakistan", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "travel-agency-accounting-ledger-pakistan", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "create-travel-quotations-in-2-minutes", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "invoice-voucher-software-travel-agents", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "track-visa-applications-without-missing-deadlines", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "umrah-cost-calculator-price-packages-profitably", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "7-mistakes-pakistani-travel-agencies-bookings", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "excel-vs-travel-agency-software-pakistan", updated_at: "2026-11-27T12:00:00.000Z" },
  { slug: "grow-travel-agency-pakistan-digital-tools", updated_at: "2026-11-27T12:00:00.000Z" },
];

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIsoDate(value) {
  if (!value) return DEFAULT_LASTMOD;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return DEFAULT_LASTMOD;
  return d.toISOString().slice(0, 10);
}

export function buildSitemapXml(publishedPosts = [], origin = PRODUCTION_ORIGIN) {
  const cleanOrigin = String(origin || PRODUCTION_ORIGIN).replace(/\/+$/, "");

  const staticXml = STATIC_SITEMAP_ENTRIES.map(
    (entry) =>
      `  <url>\n    <loc>${escapeXml(`${cleanOrigin}${entry.path}`)}</loc>\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`
  );

  const seenSlugs = new Set();
  const blogXml = [];

  const combinedPosts = [
    ...(Array.isArray(publishedPosts) ? publishedPosts : []),
    ...BUILTIN_SITEMAP_BLOG_POSTS,
  ];

  for (const post of combinedPosts) {
    if (!post || typeof post.slug !== "string") continue;
    const slug = post.slug.trim();
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);

    const lastmod = toIsoDate(post.updated_at || post.published_at);
    blogXml.push(
      `  <url>\n    <loc>${escapeXml(`${cleanOrigin}/blogs/${encodeURIComponent(slug)}`)}</loc>\n    <lastmod>${escapeXml(lastmod)}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticXml,
    ...blogXml,
    "</urlset>",
  ].join("\n");
}

export async function fetchPublishedPostsForSitemap() {
  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    FALLBACK_SUPABASE_URL
  ).replace(/\/+$/, "");
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_KEY;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const endpoint = `${supabaseUrl}/rest/v1/blog_posts?select=slug,updated_at,published_at&status=eq.published&order=published_at.desc.nullslast,created_at.desc`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error("[TAMS Sitemap] Supabase REST fetch failed:", response.status, response.statusText);
      return BUILTIN_SITEMAP_BLOG_POSTS;
    }

    const rows = await response.json();
    return Array.isArray(rows) ? rows : BUILTIN_SITEMAP_BLOG_POSTS;
  } catch (err) {
    console.error("[TAMS Sitemap] Failed to fetch published blog posts:", err);
    return BUILTIN_SITEMAP_BLOG_POSTS;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET() {
  const posts = await fetchPublishedPostsForSitemap();
  const xml = buildSitemapXml(posts, PRODUCTION_ORIGIN);

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
