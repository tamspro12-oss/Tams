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
}

const DEFAULT_OG_IMAGE = `${PRODUCTION_APP_ORIGIN}/icons/tams-icon-512.png`;

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
 * keywords, and JSON-LD structured data.
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
}: SeoHeadProps) {
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const absoluteUrl = /^https?:\/\//i.test(path)
    ? path
    : `${PRODUCTION_APP_ORIGIN}${normalizedPath}`;

  const resolvedImage = resolveSocialImageUrl(image || "");

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

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {cleanKeywords.length > 0 ? (
        <meta name="keywords" content={cleanKeywords.join(", ")} />
      ) : null}
      <link rel="canonical" href={absoluteUrl} />

      <meta property="og:site_name" content="TAMS Pro" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={absoluteUrl} />
      <meta property="og:image" content={resolvedImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={resolvedImage} />

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
