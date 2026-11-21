import { Helmet } from "react-helmet-async";
import { PRODUCTION_APP_ORIGIN } from "@/lib/authRedirect";

interface SeoHeadProps {
  title: string;
  description: string;
  path: string;
  jsonLd?: object | object[];
}

/**
 * Per-route SEO head. Sets unique title/description/canonical and og:* tags.
 * Resolves relative paths against PRODUCTION_APP_ORIGIN for canonical and og:url.
 */
export function SeoHead({ title, description, path, jsonLd }: SeoHeadProps) {
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const absoluteUrl = /^https?:\/\//i.test(path)
    ? path
    : `${PRODUCTION_APP_ORIGIN}${normalizedPath}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={absoluteUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={absoluteUrl} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {ldArray.map((obj, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(obj)}</script>
      ))}
    </Helmet>
  );
}
