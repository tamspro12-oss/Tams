import fs from "node:fs";
import path from "node:path";
import { POSTS_1_TO_3 } from "./blog-posts-1-3.mjs";
import { POSTS_4_TO_6 } from "./blog-posts-4-6.mjs";
import { POSTS_7_TO_10 } from "./blog-posts-7-10.mjs";

export const ALL_SEO_BLOG_POSTS = [...POSTS_1_TO_3, ...POSTS_4_TO_6, ...POSTS_7_TO_10];

export function stripHtmlForWordCount(html) {
  return String(html || "")
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(html) {
  const plain = stripHtmlForWordCount(html);
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

export function validateSeoPosts(posts = ALL_SEO_BLOG_POSTS) {
  const errors = [];
  const slugs = new Set(posts.map((p) => p.slug));

  if (posts.length !== 10) {
    errors.push(`Expected exactly 10 posts, found ${posts.length}`);
  }

  for (const post of posts) {
    const words = countWords(post.content);
    const readMinutes = Math.max(1, Math.ceil(words / 200));

    if (post.title.length >= 60) {
      errors.push(`[${post.slug}] title too long (${post.title.length} chars, must be < 60)`);
    }
    if (post.excerpt.length < 150 || post.excerpt.length > 160) {
      errors.push(
        `[${post.slug}] excerpt length ${post.excerpt.length} (must be 150–160 chars)`
      );
    }
    if (words < 1200 || words > 1800) {
      errors.push(`[${post.slug}] word count ${words} (must be 1,200–1,800 words)`);
    }
    if (!Array.isArray(post.tags) || post.tags.length < 6 || post.tags.length > 8) {
      errors.push(`[${post.slug}] tags count ${post.tags?.length} (must be 6–8)`);
    }
    if (!Array.isArray(post.secondary_keywords) || post.secondary_keywords.length !== 3) {
      errors.push(`[${post.slug}] must have exactly 3 secondary_keywords`);
    }
    if (!Array.isArray(post.faq_items) || post.faq_items.length < 4 || post.faq_items.length > 5) {
      errors.push(`[${post.slug}] faq_items count ${post.faq_items?.length} (must be 4–5)`);
    }
    if (/<h1\b/i.test(post.content)) {
      errors.push(`[${post.slug}] content must NOT contain <h1> (BlogDetailPage renders page H1)`);
    }
    if (!post.content.includes("/pricing") || !post.content.includes("/signup")) {
      errors.push(`[${post.slug}] content must link to both /pricing and /signup`);
    }

    const blogLinks = Array.from(post.content.matchAll(/href="\/blogs\/([a-z0-9-]+)"/g)).map(
      (m) => m[1]
    );
    const uniqueOtherBlogLinks = new Set(blogLinks.filter((s) => s !== post.slug));
    if (uniqueOtherBlogLinks.size < 2) {
      errors.push(
        `[${post.slug}] must link internally to at least 2 other blog posts (found ${uniqueOtherBlogLinks.size})`
      );
    }
    for (const linkedSlug of blogLinks) {
      if (!slugs.has(linkedSlug)) {
        errors.push(`[${post.slug}] links to unknown blog slug: ${linkedSlug}`);
      }
    }

    post._wordCount = words;
    post._readTimeMinutes = readMinutes;
  }

  return errors;
}

function escapeSqlText(str) {
  return `'${String(str ?? "").replace(/'/g, "''")}'`;
}

function sqlTextArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "ARRAY[]::TEXT[]";
  return `ARRAY[${arr.map(escapeSqlText).join(", ")}]::TEXT[]`;
}

function escapeSvgText(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapSvgTitle(title, maxChars = 28) {
  const words = title.split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length <= maxChars) {
      current = (current + " " + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

const CATEGORY_ACCENTS = {
  Software: { bg1: "#0F5E63", bg2: "#115E59", pill: "#CCFBF1", pillText: "#0F5E63" },
  Umrah: { bg1: "#0F5E63", bg2: "#064E3B", pill: "#D1FAE5", pillText: "#065F46" },
  Accounting: { bg1: "#0F172A", bg2: "#0F5E63", pill: "#E0F2FE", pillText: "#075985" },
  Ticketing: { bg1: "#134E4A", bg2: "#0F172A", pill: "#FEF3C7", pillText: "#92400E" },
  Visa: { bg1: "#1E293B", bg2: "#0F5E63", pill: "#E0E7FF", pillText: "#3730A3" },
  Growth: { bg1: "#0B4A4E", bg2: "#1E293B", pill: "#CCFBF1", pillText: "#0F5E63" },
};

function generateCoverSvg(post, index) {
  const palette = CATEGORY_ACCENTS[post.category] || CATEGORY_ACCENTS.Software;
  const lines = wrapSvgTitle(post.title, 30);
  const tspans = lines
    .map(
      (line, i) =>
        `<tspan x="80" dy="${i === 0 ? "0" : "58"}">${escapeSvgText(line)}</tspan>`
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" width="1200" height="675" role="img" aria-label="${escapeSvgText(post.cover_image_alt)}">
  <defs>
    <linearGradient id="bg-${index}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.bg1}" />
      <stop offset="100%" stop-color="${palette.bg2}" />
    </linearGradient>
    <radialGradient id="glow-${index}" cx="85%" cy="18%" r="55%">
      <stop offset="0%" stop-color="#2DD4BF" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#2DD4BF" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg-${index})" />
  <rect width="1200" height="675" fill="url(#glow-${index})" />
  <g opacity="0.12" stroke="#FFFFFF" stroke-width="1">
    <line x1="80" y1="140" x2="1120" y2="140" />
    <line x1="80" y1="540" x2="1120" y2="540" />
    <circle cx="1020" cy="210" r="140" fill="none" />
    <circle cx="1020" cy="210" r="210" fill="none" />
  </g>
  <rect x="80" y="72" width="190" height="44" rx="22" fill="${palette.pill}" />
  <text x="175" y="100" text-anchor="middle" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="18" font-weight="700" fill="${palette.pillText}">${escapeSvgText(post.category.toUpperCase())}</text>
  <text x="80" y="250" font-family="Plus Jakarta Sans, Inter, system-ui, sans-serif" font-size="48" font-weight="700" fill="#FFFFFF" letter-spacing="-0.02em">${tspans}</text>
  <text x="80" y="485" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="22" font-weight="500" fill="#CBD5E1">${escapeSvgText(post.focus_keyword)} • Pakistan Travel Agency Guide</text>
  <text x="80" y="595" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="24" font-weight="700" fill="#FFFFFF">TAMS PRO</text>
  <text x="230" y="595" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="20" font-weight="500" fill="#99F6E4">tamspro.online • PKR 999/mo</text>
</svg>
`;
}

function buildMigrationSql(posts) {
  const statements = posts.map((post) => {
    const coverUrl = `/blog-covers/${post.slug}.svg`;
    return `INSERT INTO public.blog_posts (
  title,
  slug,
  excerpt,
  content,
  cover_image_url,
  category,
  tags,
  author,
  status,
  is_featured,
  seo_title,
  seo_description,
  focus_keyword,
  secondary_keywords,
  cover_image_alt,
  cover_image_description,
  read_time_minutes,
  faq_items,
  published_at
)
VALUES (
  ${escapeSqlText(post.title)},
  ${escapeSqlText(post.slug)},
  ${escapeSqlText(post.excerpt)},
  ${escapeSqlText(post.content)},
  ${escapeSqlText(coverUrl)},
  ${escapeSqlText(post.category)},
  ${sqlTextArray(post.tags)},
  'TAMS Pro Team',
  'published',
  ${post.is_featured ? "true" : "false"},
  ${escapeSqlText(post.title)},
  ${escapeSqlText(post.excerpt)},
  ${escapeSqlText(post.focus_keyword)},
  ${sqlTextArray(post.secondary_keywords)},
  ${escapeSqlText(post.cover_image_alt)},
  ${escapeSqlText(post.cover_image_description)},
  ${post._readTimeMinutes},
  ${escapeSqlText(JSON.stringify(post.faq_items))}::jsonb,
  ${escapeSqlText(post.published_at)}::timestamptz
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  content = EXCLUDED.content,
  cover_image_url = EXCLUDED.cover_image_url,
  category = EXCLUDED.category,
  tags = EXCLUDED.tags,
  author = EXCLUDED.author,
  status = EXCLUDED.status,
  is_featured = EXCLUDED.is_featured,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description,
  focus_keyword = EXCLUDED.focus_keyword,
  secondary_keywords = EXCLUDED.secondary_keywords,
  cover_image_alt = EXCLUDED.cover_image_alt,
  cover_image_description = EXCLUDED.cover_image_description,
  read_time_minutes = EXCLUDED.read_time_minutes,
  faq_items = EXCLUDED.faq_items,
  published_at = EXCLUDED.published_at,
  updated_at = now();`;
  });

  return `-- ==============================================================================
-- TAMS PRO — SEO BLOG SCHEMA EXTENSIONS, LEAD CAPTURE & 10 PUBLISHED BLOG POSTS
-- File: supabase/migrations/20261122150000_blog_seo_fields_and_10_posts.sql
--
-- STRICTLY ADDITIVE & IDEMPOTENT:
--   - Adds SEO metadata & FAQ JSONB columns to public.blog_posts
--   - Creates public.blog_leads table with anon insert & super_admin read RLS
--   - Upserts all 10 published SEO blog posts for tamspro.online/blogs
-- ==============================================================================

BEGIN;

-- 1. Extend public.blog_posts with SEO & FAQ metadata
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS focus_keyword TEXT;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS secondary_keywords TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS cover_image_alt TEXT;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS cover_image_description TEXT;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS read_time_minutes INTEGER;

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS faq_items JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Create public.blog_leads for article bottom WhatsApp/walkthrough capture
CREATE TABLE IF NOT EXISTS public.blog_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_name TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  email TEXT,
  source_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_leads ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON public.blog_leads TO anon, authenticated;
GRANT SELECT, DELETE ON public.blog_leads TO authenticated;

DROP POLICY IF EXISTS "blog_leads_public_insert" ON public.blog_leads;
CREATE POLICY "blog_leads_public_insert"
  ON public.blog_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(btrim(agency_name)) >= 2
    AND char_length(btrim(whatsapp)) >= 7
  );

DROP POLICY IF EXISTS "blog_leads_admin_select" ON public.blog_leads;
CREATE POLICY "blog_leads_admin_select"
  ON public.blog_leads
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

DROP POLICY IF EXISTS "blog_leads_admin_delete" ON public.blog_leads;
CREATE POLICY "blog_leads_admin_delete"
  ON public.blog_leads
  FOR DELETE
  TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'super_admin'::public.app_role)));

-- 3. Upsert 10 published SEO blog posts
${statements.join("\n\n")}

COMMIT;
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const errors = validateSeoPosts(ALL_SEO_BLOG_POSTS);
  if (errors.length > 0) {
    console.error("Validation failed:\n" + errors.map((e) => " - " + e).join("\n"));
    process.exit(1);
  }

  const coversDir = path.resolve("public/blog-covers");
  fs.mkdirSync(coversDir, { recursive: true });

  ALL_SEO_BLOG_POSTS.forEach((post, idx) => {
    const svg = generateCoverSvg(post, idx);
    fs.writeFileSync(path.join(coversDir, `${post.slug}.svg`), svg, "utf8");
    console.log(
      `✓ ${post.slug} | title=${post.title.length}c | excerpt=${post.excerpt.length}c | words=${post._wordCount} | read=${post._readTimeMinutes}m | tags=${post.tags.length} | faqs=${post.faq_items.length}`
    );
  });

  const sqlPath = path.resolve("supabase/migrations/20261122150000_blog_seo_fields_and_10_posts.sql");
  fs.writeFileSync(sqlPath, buildMigrationSql(ALL_SEO_BLOG_POSTS), "utf8");
  console.log(`\nWrote migration: ${sqlPath}`);
}
