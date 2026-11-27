import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { PRODUCTION_APP_ORIGIN } from "@/lib/authRedirect";

interface SeoHeadProps {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
  author?: string | null;
  tags?: string[];
  keywords?: string[];
  jsonLd?: object | object[];
  noindex?: boolean;
}

const DEFAULT_OG_IMAGE = `${PRODUCTION_APP_ORIGIN}/og-image.png`;
const NOINDEX_PATH_PREFIXES = [
  "/app",
  "/admin",
  "/login",
  "/signup",
  "/auth",
  "/reset-password",
  "/verify-email",
  "/confirm-email",
  "/subscription-expired",
  "/404",
];

function isPrivateOrNoindexPath(normalizedPath: string): boolean {
  const lower = normalizedPath.toLowerCase();
  return NOINDEX_PATH_PREFIXES.some(
    (prefix) => lower === prefix || lower.startsWith(`${prefix}/`)
  );
}

function resolveSocialImageUrl(rawImage: string): string {
  const trimmed = rawImage.trim();
  if (!trimmed || /\.svg(?:[?#].*)?$/i.test(trimmed)) {
    return DEFAULT_OG_IMAGE;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `${PRODUCTION_APP_ORIGIN}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

/**
 * Per-route SEO head. Sets unique title/description/canonical, Open Graph / Twitter tags,
 * keywords, robots directives, hreflang, and JSON-LD structured data.
 */
export function SeoHead({
  title,
  description,
  path,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
  author,
  tags,
  keywords,
  jsonLd,
  noindex,
}: SeoHeadProps) {
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const absoluteUrl = /^https?:\/\//i.test(path)
    ? path
    : `${PRODUCTION_APP_ORIGIN}${normalizedPath}`;

  const shouldNoindex = Boolean(noindex) || isPrivateOrNoindexPath(normalizedPath);
  const robotsContent = shouldNoindex
    ? "noindex, nofollow"
    : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

  const resolvedImage = resolveSocialImageUrl(image || "");
  const isDefaultOgImage = resolvedImage === DEFAULT_OG_IMAGE;

  const cleanTags = Array.isArray(tags)
    ? tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];

  const cleanKeywords = Array.isArray(keywords)
    ? Array.from(
        new Set(
          keywords
            .filter((k): k is string => typeof k === "string" && k.trim().length > 0)
            .map((k) => k.trim())
        )
      )
    : [];

  const hasJsonLd = ldArray.length > 0;

  useEffect(() => {
    if (typeof document === "undefined" || !document.head) return;

    document.documentElement.setAttribute("lang", "en-PK");

    if (hasJsonLd || normalizedPath !== "/") {
      document.head
        .querySelectorAll('script[data-tams-ssr-jsonld="true"]')
        .forEach((node) => node.remove());
    }

    const dedupeSelectors = [
      'link[rel="canonical"]',
      'link[rel="alternate"][hreflang="en-PK"]',
      'link[rel="alternate"][hreflang="x-default"]',
      'meta[name="robots"]',
      'meta[name="description"]',
      'meta[name="keywords"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:url"]',
      'meta[property="og:type"]',
      'meta[property="og:image"]',
      'meta[property="og:image:width"]',
      'meta[property="og:image:height"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'meta[name="twitter:image"]',
    ];

    for (const selector of dedupeSelectors) {
      if (document.head.querySelector(`${selector}[data-rh="true"]`)) {
        document.head
          .querySelectorAll(`${selector}:not([data-rh])`)
          .forEach((node) => node.remove());
      }
    }
  }, [title, description, absoluteUrl, normalizedPath, hasJsonLd, robotsContent]);

  return (
    <Helmet>
      <html lang="en-PK" />
      <title>{title}</title>
      <meta name="robots" content={robotsContent} />
      <meta name="description" content={description} />
      {cleanKeywords.length > 0 ? (
        <meta name="keywords" content={cleanKeywords.join(", ")} />
      ) : null}
      <link rel="canonical" href={absoluteUrl} />
      {!shouldNoindex ? (
        <link rel="alternate" hrefLang="en-PK" href={absoluteUrl} />
      ) : null}
      {!shouldNoindex ? (
        <link rel="alternate" hrefLang="x-default" href={absoluteUrl} />
      ) : null}

      <meta property="og:site_name" content="TAMS Pro" />
      <meta property="og:locale" content="en_PK" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={absoluteUrl} />
      <meta property="og:image" content={resolvedImage} />
      {isDefaultOgImage ? <meta property="og:image:width" content="1200" /> : null}
      {isDefaultOgImage ? <meta property="og:image:height" content="630" /> : null}
      <meta property="og:image:alt" content={title} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={resolvedImage} />
      <meta name="twitter:image:alt" content={title} />

      {type === "article" && publishedTime ? (
        <meta property="article:published_time" content={publishedTime} />
      ) : null}
      {type === "article" && modifiedTime ? (
        <meta property="article:modified_time" content={modifiedTime} />
      ) : null}
      {type === "article" && author ? (
        <meta property="article:author" content={author} />
      ) : null}
      {type === "article"
        ? cleanTags.map((tag) => <meta key={tag} property="article:tag" content={tag} />)
        : null}

      {ldArray.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
}
