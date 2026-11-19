import "./ts-alias-register.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { generateBlogSlug, formatBlogDate, estimateReadMinutes } = await import(
  "../src/lib/blogs.ts"
);
const { isSafeUrl, sanitizeHtmlString, renderSafeBlogContent } = await import(
  "../src/lib/blogSanitizer.ts"
);

test("generateBlogSlug normalizes titles into clean URL slugs", () => {
  assert.equal(
    generateBlogSlug("  How to Manage Umrah & Visa Bookings in 2026! "),
    "how-to-manage-umrah-visa-bookings-in-2026"
  );
  assert.equal(generateBlogSlug("Multiple   Spaces---Here"), "multiple-spaces-here");
  assert.equal(generateBlogSlug("---Trim Edges---"), "trim-edges");
  assert.equal(generateBlogSlug("!!!"), "");
});

test("formatBlogDate and estimateReadMinutes handle normal and missing values", () => {
  assert.equal(formatBlogDate(null), "");
  assert.equal(formatBlogDate("not-a-date"), "");
  assert.match(formatBlogDate("2026-11-19T10:00:00.000Z"), /Nov\s+19,\s+2026/);
  assert.equal(estimateReadMinutes(""), 1);
  assert.equal(estimateReadMinutes("word ".repeat(450)), 3);
});

test("isSafeUrl blocks javascript, vbscript, data, and obfuscated URLs", () => {
  assert.equal(isSafeUrl("https://tamspro.vercel.app/features"), true);
  assert.equal(isSafeUrl("http://localhost:4173/blogs"), true);
  assert.equal(isSafeUrl("/signup"), true);
  assert.equal(isSafeUrl("mailto:tamspro12@gmail.com", { allowMailto: true }), true);

  assert.equal(isSafeUrl("javascript:alert(1)"), false);
  assert.equal(isSafeUrl("  JaVaScRiPt:alert(1)"), false);
  assert.equal(isSafeUrl("java\nscript:alert(1)"), false);
  assert.equal(isSafeUrl("vbscript:msgbox(1)"), false);
  assert.equal(isSafeUrl("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeUrl("//evil.example.com"), false);
});

test("renderSafeBlogContent formats markdown headings, bold, lists, quotes, links, and images", () => {
  const md = [
    "## Agency Growth",
    "",
    "Manage **bookings** and *vouchers* in [TAMS Pro](/signup).",
    "",
    "- Fast quoting",
    "- Automated ledgers",
    "",
    "> Save hours weekly.",
    "",
    "![Umrah Guide](https://example.com/cover.jpg)",
  ].join("\n");

  const html = renderSafeBlogContent(md);
  assert.match(html, /<h2>Agency Growth<\/h2>/);
  assert.match(html, /<strong>bookings<\/strong>/);
  assert.match(html, /<em>vouchers<\/em>/);
  assert.match(html, /<a href="\/signup">TAMS Pro<\/a>/);
  assert.match(html, /<ul><li>Fast quoting<\/li><li>Automated ledgers<\/li><\/ul>/);
  assert.match(html, /<blockquote><p>Save hours weekly\.<\/p><\/blockquote>/);
  assert.match(
    html,
    /<img src="https:\/\/example\.com\/cover\.jpg" alt="Umrah Guide" loading="lazy" \/>/
  );
});

test("sanitizeHtmlString & renderSafeBlogContent strip XSS payloads thoroughly", () => {
  const dirtyHtml = `
    <h2>Safe Title</h2>
    <script>alert('xss')</script>
    <style>body{display:none}</style>
    <p onclick="alert(1)">Hello <strong onmouseover="evil()">World</strong></p>
    <img src="javascript:alert(1)" onerror="alert(2)" />
    <img src="https://example.com/ok.png" onerror="alert(3)" alt="ok" />
    <a href="javascript:alert(4)" onclick="alert(5)">Bad Link</a>
    <a href="https://tamspro.vercel.app" onclick="steal()">Good Link</a>
    <iframe src="https://evil.com"></iframe>
    <svg onload="alert(6)"><circle /></svg>
    <p>Text with <a href="data:text/html,<script>alert(7)</script>">data link</a></p>
  `;

  const sanitized = sanitizeHtmlString(dirtyHtml);
  assert.doesNotMatch(sanitized, /<script/i);
  assert.doesNotMatch(sanitized, /<style/i);
  assert.doesNotMatch(sanitized, /<iframe/i);
  assert.doesNotMatch(sanitized, /<svg/i);
  assert.doesNotMatch(sanitized, /onerror/i);
  assert.doesNotMatch(sanitized, /onclick/i);
  assert.doesNotMatch(sanitized, /onmouseover/i);
  assert.doesNotMatch(sanitized, /onload/i);
  assert.doesNotMatch(sanitized, /javascript:/i);
  assert.doesNotMatch(sanitized, /data:text\/html/i);

  assert.match(sanitized, /<h2>Safe Title<\/h2>/);
  assert.match(sanitized, /<strong>World<\/strong>/);
  assert.match(
    sanitized,
    /<img src="https:\/\/example\.com\/ok\.png" alt="ok" loading="lazy" \/>/
  );
  assert.match(
    sanitized,
    /<a href="https:\/\/tamspro\.vercel\.app" target="_blank" rel="noopener noreferrer">Good Link<\/a>/
  );

  // Markdown injection attempt
  const dirtyMd = `Hello [click](javascript:alert(1)) and ![x](data:text/html,evil) and <script>alert(9)</script>`;
  const safeMd = renderSafeBlogContent(dirtyMd);
  assert.doesNotMatch(safeMd, /<script/i);
  assert.doesNotMatch(safeMd, /javascript:/i);
  assert.doesNotMatch(safeMd, /data:text\/html/i);
});

