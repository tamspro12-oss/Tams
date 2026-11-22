const PRODUCTION_ORIGIN = "https://tamspro.online";

const FALLBACK_SUPABASE_URL = "https://mwpbschzwjxeioyrzskv.supabase.co";
const FALLBACK_SUPABASE_KEY = "sb_publishable_0sFy40NHfnRGnNz07iOF7g_lRqo6_hf";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serializeJsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function resolveSocialImage(rawImage, cleanOrigin) {
  const trimmed = String(rawImage || "").trim();
  const fallback = `${cleanOrigin}/icons/tams-icon-512.png`;
  if (!trimmed || /\.svg(?:[?#].*)?$/i.test(trimmed)) {
    return fallback;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${cleanOrigin}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

function replaceOrInsertHeadTag(html, regex, replacementTag) {
  if (regex.test(html)) {
    return html.replace(regex, replacementTag);
  }
  return html.replace(/<\/head>/i, `    ${replacementTag}\n  </head>`);
}

function sanitizeNoscriptHtml(html) {
  return String(html || "")
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*iframe\b[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, "")
    .replace(/<\/?\s*noscript\b[^>]*>/gi, "");
}

function collectKeywords(post) {
  const candidates = [
    post?.focus_keyword,
    ...(Array.isArray(post?.secondary_keywords) ? post.secondary_keywords : []),
    ...(Array.isArray(post?.tags) ? post.tags : []),
  ];
  const seen = new Set();
  const result = [];
  for (const item of candidates) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/**
 * Inject per-post title, meta description, Open Graph, Twitter, JSON-LD schemas,
 * and <noscript> semantic HTML into the SPA shell for crawlers on first byte.
 */
export function injectBlogSeoIntoHtml(html, post, origin = PRODUCTION_ORIGIN) {
  if (!html || !post || !post.slug) {
    return html;
  }

  const cleanOrigin = String(origin || PRODUCTION_ORIGIN).replace(/\/+$/, "");
  const slug = String(post.slug).trim();
  const canonicalUrl = `${cleanOrigin}/blogs/${encodeURIComponent(slug)}`;

  const rawTitle = String(post.seo_title || post.title || "TAMS Pro Blog").trim();
  const fullTitle = `${rawTitle} | TAMS Pro Blog`;
  const description = String(
    post.seo_description || post.excerpt || "Insights for Pakistani travel agencies from TAMS Pro."
  ).trim();
  const authorName = String(post.author || "TAMS Pro Team").trim();
  const imageUrl = resolveSocialImage(post.cover_image_url, cleanOrigin);
  const imageAlt = String(post.cover_image_alt || post.title || "TAMS Pro Blog").trim();
  const keywords = collectKeywords(post);
  const cleanTags = Array.isArray(post.tags)
    ? post.tags.filter((t) => typeof t === "string" && t.trim().length > 0).map((t) => t.trim())
    : [];

  let nextHtml = String(html).replace(
    /<script\b[^>]*data-tams-ssr-jsonld="true"[^>]*>[\s\S]*?<\/script>\s*/gi,
    ""
  );

  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(fullTitle)}</title>`
  );
  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*name=["']description["'][^>]*>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  );

  if (keywords.length > 0) {
    nextHtml = replaceOrInsertHeadTag(
      nextHtml,
      /<meta\b[^>]*name=["']keywords["'][^>]*>/i,
      `<meta name="keywords" content="${escapeHtml(keywords.join(", "))}" />`
    );
  }

  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<link\b[^>]*rel=["']canonical["'][^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
  );

  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*property=["']og:type["'][^>]*>/i,
    `<meta property="og:type" content="article" />`
  );
  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*property=["']og:title["'][^>]*>/i,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}" />`
  );
  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*property=["']og:description["'][^>]*>/i,
    `<meta property="og:description" content="${escapeHtml(description)}" />`
  );
  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*property=["']og:url["'][^>]*>/i,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`
  );
  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*property=["']og:image["'][^>]*>/i,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`
  );
  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*property=["']og:image:alt["'][^>]*>/i,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}" />`
  );

  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*name=["']twitter:title["'][^>]*>/i,
    `<meta name="twitter:title" content="${escapeHtml(fullTitle)}" />`
  );
  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*name=["']twitter:description["'][^>]*>/i,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`
  );
  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*name=["']twitter:image["'][^>]*>/i,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`
  );
  nextHtml = replaceOrInsertHeadTag(
    nextHtml,
    /<meta\b[^>]*name=["']twitter:image:alt["'][^>]*>/i,
    `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}" />`
  );

  const extraArticleMeta = [];
  if (post.published_at) {
    extraArticleMeta.push(
      `    <meta property="article:published_time" content="${escapeHtml(post.published_at)}" />`
    );
  }
  if (post.updated_at || post.published_at) {
    extraArticleMeta.push(
      `    <meta property="article:modified_time" content="${escapeHtml(post.updated_at || post.published_at)}" />`
    );
  }
  if (authorName) {
    extraArticleMeta.push(
      `    <meta property="article:author" content="${escapeHtml(authorName)}" />`
    );
  }
  for (const tag of cleanTags) {
    extraArticleMeta.push(`    <meta property="article:tag" content="${escapeHtml(tag)}" />`);
  }

  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: rawTitle,
      description,
      image: [imageUrl],
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": canonicalUrl,
      },
      url: canonicalUrl,
      datePublished: post.published_at || post.updated_at || undefined,
      dateModified: post.updated_at || post.published_at || undefined,
      author: {
        "@type": "Organization",
        name: authorName,
        url: cleanOrigin,
      },
      publisher: {
        "@type": "Organization",
        name: "TAMS Pro",
        logo: {
          "@type": "ImageObject",
          url: `${cleanOrigin}/icons/tams-icon-512.png`,
        },
      },
      articleSection: post.category || "Travel Agency Management",
      ...(keywords.length > 0 ? { keywords: keywords.join(", ") } : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${cleanOrigin}/` },
        { "@type": "ListItem", position: 2, name: "Blogs", item: `${cleanOrigin}/blogs` },
        { "@type": "ListItem", position: 3, name: String(post.title || rawTitle), item: canonicalUrl },
      ],
    },
  ];

  if (Array.isArray(post.faq_items)) {
    const validFaqs = post.faq_items.filter(
      (f) => f && typeof f.question === "string" && f.question.trim() && typeof f.answer === "string" && f.answer.trim()
    );
    if (validFaqs.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: validFaqs.map((faq) => ({
          "@type": "Question",
          name: faq.question.trim(),
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer.trim(),
          },
        })),
      });
    }
  }

  const schemaScripts = schemas
    .map(
      (schema) =>
        `    <script type="application/ld+json" data-tams-ssr-jsonld="true">${serializeJsonLd(schema)}</script>`
    )
    .join("\n");

  const headInjections = [...extraArticleMeta, schemaScripts].filter(Boolean).join("\n");
  if (headInjections) {
    nextHtml = nextHtml.replace(/<\/head>/i, `${headInjections}\n  </head>`);
  }

  const safeNoscriptBody = sanitizeNoscriptHtml(post.content || "");
  const noscriptBlock = `<noscript><main><article><h1>${escapeHtml(
    post.title || rawTitle
  )}</h1><p>${escapeHtml(description)}</p>${safeNoscriptBody}</article></main></noscript>`;

  if (/<div\s+id=["']root["']\s*>\s*<\/div>/i.test(nextHtml)) {
    nextHtml = nextHtml.replace(
      /<div\s+id=["']root["']\s*>\s*<\/div>/i,
      `<div id="root"></div>\n    ${noscriptBlock}`
    );
  } else {
    nextHtml = nextHtml.replace(/<body\b[^>]*>/i, (m) => `${m}\n    ${noscriptBlock}`);
  }

  return nextHtml;
}

async function fetchIndexShell(reqOrigin, signal) {
  const candidates = Array.from(
    new Set([`${reqOrigin}/index.html`, `${PRODUCTION_ORIGIN}/index.html`])
  );

  for (const url of candidates) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "text/html" },
        signal,
      });
      if (response.ok) {
        const text = await response.text();
        if (text && /<html/i.test(text)) {
          return text;
        }
      }
    } catch {
      // Try next fallback shell URL
    }
  }
  return "";
}

async function fetchPublishedBlogPost(slug, signal) {
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    return null;
  }

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

  const selectCols = [
    "title",
    "slug",
    "excerpt",
    "content",
    "cover_image_url",
    "cover_image_alt",
    "category",
    "tags",
    "author",
    "seo_title",
    "seo_description",
    "focus_keyword",
    "secondary_keywords",
    "faq_items",
    "published_at",
    "updated_at",
  ].join(",");

  try {
    const endpoint = `${supabaseUrl}/rest/v1/blog_posts?select=${selectCols}&slug=eq.${encodeURIComponent(
      slug
    )}&status=eq.published&limit=1`;

    const response = await fetch(endpoint, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Accept: "application/json",
      },
      signal,
    });

    if (!response.ok) {
      return null;
    }

    const rows = await response.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

export async function GET(request) {
  const reqUrl = new URL(request.url);
  const slug = (reqUrl.searchParams.get("slug") || "").trim();
  const reqOrigin = /^https?:\/\//i.test(reqUrl.origin)
    ? reqUrl.origin.replace(/\/+$/, "")
    : PRODUCTION_ORIGIN;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const [html, post] = await Promise.all([
      fetchIndexShell(reqOrigin, controller.signal),
      fetchPublishedBlogPost(slug, controller.signal),
    ]);

    if (!html) {
      return new Response("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    if (post) {
      return new Response(injectBlogSeoIntoHtml(html, post, PRODUCTION_ORIGIN), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      });
    }

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

