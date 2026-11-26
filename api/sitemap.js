const PRODUCTION_ORIGIN = "https://tamspro.online";

const FALLBACK_SUPABASE_URL = "https://mwpbschzwjxeioyrzskv.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_0sFy40NHfnRGnNz07iOF7g_lRqo6_hf";

const STATIC_SITEMAP_ENTRIES = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/features", changefreq: "monthly", priority: "0.8" },
  { path: "/pricing", changefreq: "monthly", priority: "0.8" },
  { path: "/blogs", changefreq: "daily", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/faq", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
  { path: "/signup", changefreq: "yearly", priority: "0.5" },
  { path: "/install", changefreq: "monthly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/refund-policy", changefreq: "yearly", priority: "0.3" },
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
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function buildSitemapXml(publishedPosts = [], origin = PRODUCTION_ORIGIN) {
  const cleanOrigin = String(origin || PRODUCTION_ORIGIN).replace(/\/+$/, "");

  const staticXml = STATIC_SITEMAP_ENTRIES.map(
    (entry) =>
      `  <url><loc>${escapeXml(`${cleanOrigin}${entry.path}`)}</loc><changefreq>${entry.changefreq}</changefreq><priority>${entry.priority}</priority></url>`
  );

  const seenSlugs = new Set();
  const blogXml = [];

  if (Array.isArray(publishedPosts)) {
    for (const post of publishedPosts) {
      if (!post || typeof post.slug !== "string") continue;
      const slug = post.slug.trim();
      if (!slug || seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      const lastmod = toIsoDate(post.updated_at || post.published_at);
      const lastmodTag = lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : "";
      blogXml.push(
        `  <url><loc>${escapeXml(`${cleanOrigin}/blogs/${encodeURIComponent(slug)}`)}</loc>${lastmodTag}<changefreq>weekly</changefreq><priority>0.8</priority></url>`
      );
    }
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
      return [];
    }

    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.error("[TAMS Sitemap] Failed to fetch published blog posts:", err);
    return [];
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

