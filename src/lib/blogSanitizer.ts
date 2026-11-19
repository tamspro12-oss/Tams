/**
 * Safe HTML & Markdown sanitizer for TAMS Pro public blog posts.
 * Zero external dependencies. Supports headings, paragraphs, bold, italic,
 * lists, blockquotes, inline code, horizontal rules, safe links, and safe images.
 * Strips scripts, iframes, SVGs, event handlers, styles, and dangerous URLs.
 */

const ALLOWED_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "hr",
  "a",
  "img",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

const STRIP_CONTENT_TAGS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "svg",
  "math",
  "noscript",
  "template",
]);

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unescapeBasicEntities(input: string): string {
  return input
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function stripControlAndWhitespace(url: string): string {
  let out = "";
  for (let i = 0; i < url.length; i++) {
    const code = url.charCodeAt(i);
    if (code > 32 && code !== 127) {
      out += url[i];
    }
  }
  return out;
}

export function isSafeUrl(
  rawUrl: string,
  options: { allowMailto?: boolean } = {}
): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  const decoded = unescapeBasicEntities(rawUrl).trim();
  if (!decoded) return false;

  const normalized = stripControlAndWhitespace(decoded).toLowerCase();
  if (!normalized) return false;

  if (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("file:")
  ) {
    return false;
  }

  // Relative root paths (/features, /pricing, /signup, etc.) or hash anchors
  if (
    (normalized.startsWith("/") && !normalized.startsWith("//")) ||
    normalized.startsWith("#")
  ) {
    return true;
  }

  if (normalized.startsWith("https://") || normalized.startsWith("http://")) {
    return true;
  }

  if (options.allowMailto && normalized.startsWith("mailto:")) {
    return true;
  }

  return false;
}

function sanitizeAttributeValue(val: string): string {
  return escapeHtml(unescapeBasicEntities(val).trim());
}

function serializeAllowedElement(
  tagName: string,
  getAttr: (name: string) => string | null,
  innerHtml: string
): string {
  if (!ALLOWED_TAGS.has(tagName)) {
    return innerHtml;
  }

  if (tagName === "br" || tagName === "hr") {
    return `<${tagName} />`;
  }

  if (tagName === "a") {
    const rawHref = getAttr("href") || "";
    if (!isSafeUrl(rawHref, { allowMailto: true })) {
      return innerHtml;
    }
    const safeHref = sanitizeAttributeValue(rawHref);
    const isExternal =
      safeHref.toLowerCase().startsWith("http://") ||
      safeHref.toLowerCase().startsWith("https://");
    const extra = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${safeHref}"${extra}>${innerHtml}</a>`;
  }

  if (tagName === "img") {
    const rawSrc = getAttr("src") || "";
    if (!isSafeUrl(rawSrc, { allowMailto: false })) {
      return "";
    }
    const safeSrc = sanitizeAttributeValue(rawSrc);
    const rawAlt = getAttr("alt") || "";
    const safeAlt = sanitizeAttributeValue(rawAlt);
    return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy" />`;
  }

  return `<${tagName}>${innerHtml}</${tagName}>`;
}

function sanitizeDomNode(node: Node): string {
  // Node.TEXT_NODE === 3
  if (node.nodeType === 3) {
    return escapeHtml(node.textContent || "");
  }

  // Node.ELEMENT_NODE === 1
  if (node.nodeType !== 1) {
    return "";
  }

  const el = node as Element;
  const tagName = el.tagName.toLowerCase();

  if (STRIP_CONTENT_TAGS.has(tagName)) {
    return "";
  }

  if (VOID_TAGS.has(tagName)) {
    return serializeAllowedElement(tagName, (attr) => el.getAttribute(attr), "");
  }

  let childrenHtml = "";
  for (let i = 0; i < el.childNodes.length; i++) {
    childrenHtml += sanitizeDomNode(el.childNodes[i]);
  }

  return serializeAllowedElement(tagName, (attr) => el.getAttribute(attr), childrenHtml);
}

function extractAttrFromRawAttrs(rawAttrs: string, attrName: string): string | null {
  if (!rawAttrs) return null;
  const pattern = new RegExp(
    `(?:^|\\s)${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>` + "`" + `]+))`,
    "i"
  );
  const match = rawAttrs.match(pattern);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

function sanitizeWithTokenFallback(rawHtml: string): string {
  // Remove blocked tags along with their inner contents
  let cleaned = rawHtml.replace(
    /<\s*(script|style|iframe|object|embed|svg|math|noscript|template)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ""
  );
  // Remove unclosed or self-closing dangerous tags
  cleaned = cleaned.replace(
    /<\s*\/?\s*(script|style|iframe|object|embed|svg|math|noscript|template)\b[^>]*>/gi,
    ""
  );
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

  return cleaned.replace(
    /<\s*(\/?)\s*([a-zA-Z0-9-]+)([^>]*)>/g,
    (_full, slash: string, rawTag: string, rawAttrs: string) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) {
        return "";
      }

      if (slash === "/") {
        return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
      }

      if (tag === "br" || tag === "hr") {
        return `<${tag} />`;
      }

      if (tag === "a") {
        const href = extractAttrFromRawAttrs(rawAttrs, "href") || "";
        if (!isSafeUrl(href, { allowMailto: true })) {
          return "<a>";
        }
        const safeHref = sanitizeAttributeValue(href);
        const isExternal =
          safeHref.toLowerCase().startsWith("http://") ||
          safeHref.toLowerCase().startsWith("https://");
        const extra = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
        return `<a href="${safeHref}"${extra}>`;
      }

      if (tag === "img") {
        const src = extractAttrFromRawAttrs(rawAttrs, "src") || "";
        if (!isSafeUrl(src, { allowMailto: false })) {
          return "";
        }
        const safeSrc = sanitizeAttributeValue(src);
        const alt = extractAttrFromRawAttrs(rawAttrs, "alt") || "";
        const safeAlt = sanitizeAttributeValue(alt);
        return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy" />`;
      }

      return `<${tag}>`;
    }
  );
}

export function sanitizeHtmlString(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== "string") return "";

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, "text/html");
      let result = "";
      for (let i = 0; i < doc.body.childNodes.length; i++) {
        result += sanitizeDomNode(doc.body.childNodes[i]);
      }
      return result;
    } catch {
      return sanitizeWithTokenFallback(rawHtml);
    }
  }

  return sanitizeWithTokenFallback(rawHtml);
}

function renderInlineMarkdown(text: string): string {
  // First escape raw HTML characters in inline markdown so raw <script> cannot execute
  let out = escapeHtml(text);

  // Inline code (`code`) — preserve contents escaped
  const codeTokens: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_m, codeContent: string) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code>${codeContent}</code>`);
    return `%%TAMSCODETOKEN${idx}%%`;
  });

  // Images ![alt](url)
  out = out.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt: string, url: string) => {
    const trimmedUrl = unescapeBasicEntities(url).trim();
    if (!isSafeUrl(trimmedUrl, { allowMailto: false })) {
      return "";
    }
    return `<img src="${escapeHtml(trimmedUrl)}" alt="${alt}" loading="lazy" />`;
  });

  // Links [label](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
    const trimmedUrl = unescapeBasicEntities(url).trim();
    if (!isSafeUrl(trimmedUrl, { allowMailto: true })) {
      return label;
    }
    const safeUrl = escapeHtml(trimmedUrl);
    const isExternal =
      safeUrl.toLowerCase().startsWith("http://") ||
      safeUrl.toLowerCase().startsWith("https://");
    const extra = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${safeUrl}"${extra}>${label}</a>`;
  });

  // Bold (**text** or __text__)
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/__([^_]+)__/g, "<strong>$1</strong>");

  // Italic (*text* or _text_)
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");

  // Restore inline code tokens
  out = out.replace(/%%TAMSCODETOKEN(\d+)%%/g, (_m, idxStr: string) => {
    return codeTokens[Number(idxStr)] || "";
  });

  return out;
}

function markdownToHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const blocks: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      blocks.push("<hr />");
      i++;
      continue;
    }

    // Headings (# to ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote (> ...)
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        `<blockquote><p>${quoteLines.map(renderInlineMarkdown).join("<br />")}</p></blockquote>`
      );
      continue;
    }

    // Unordered list (- or *)
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInlineMarkdown(lines[i].trim().replace(/^[-*]\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    // Ordered list (1. )
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${renderInlineMarkdown(lines[i].trim().replace(/^\d+\.\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    // Paragraph (gather until blank line or block starter)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (
        !cur ||
        /^(#{1,4})\s+/.test(cur) ||
        cur.startsWith(">") ||
        /^[-*]\s+/.test(cur) ||
        /^\d+\.\s+/.test(cur) ||
        /^(-{3,}|\*{3,})$/.test(cur)
      ) {
        break;
      }
      paraLines.push(cur);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push(`<p>${paraLines.map(renderInlineMarkdown).join("<br />")}</p>`);
    }
  }

  return blocks.join("\n");
}

/**
 * Converts Markdown or HTML blog content into sanitized, safe HTML ready for rendering.
 */
export function renderSafeBlogContent(rawContent: string): string {
  if (!rawContent || typeof rawContent !== "string") return "";
  const trimmed = rawContent.trim();
  if (!trimmed) return "";

  const looksLikeHtmlBlock = /<\s*(p|h[1-4]|ul|ol|li|div|blockquote|section|article|br)\b/i.test(
    trimmed
  );

  if (looksLikeHtmlBlock) {
    return sanitizeHtmlString(trimmed);
  }

  const convertedHtml = markdownToHtml(trimmed);
  return sanitizeHtmlString(convertedHtml);
}
