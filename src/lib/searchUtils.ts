import React from "react";

/**
 * Normalizes search text by trimming, lowercasing, removing extra whitespace,
 * stripping common field prefixes (PNR:, INV-, TKT:, etc.), and normalizing dashes/slashes.
 */
export function normalizeSearchQuery(text: string): string {
  if (!text) return "";
  let s = text.trim().toLowerCase();
  // Strip common label prefixes like "pnr:", "pnr -", "invoice #", "inv:", "tkt:", "ticket:", "voucher:", "ref:", "exp:"
  s = s.replace(
    /^(pnr|invoice|inv|ticket|tkt|voucher|vch|refund|ref|passport|exp|expense)\s*[:#\-–—]?\s*/i,
    ""
  );
  // Replace multiple spaces/dashes with single space
  s = s.replace(/[\s\-_/]+/g, " ");
  return s.trim();
}

/**
 * Clean pasted search value (removes labels and extra spaces).
 */
export function cleanPastedSearch(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .replace(
      /^(pnr|invoice|inv|ticket|tkt|voucher|vch|refund|ref|passport|exp|expense)\s*[:#\-–—]?\s*/i,
      ""
    )
    .trim();
}

/**
 * Shared paste handler for input elements that immediately strips labels,
 * trims spaces, and triggers state change.
 */
export function createPasteHandler(
  onChange: (val: string) => void,
  onImmediateSearch?: () => void
) {
  return (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (pasted) {
      e.preventDefault();
      const cleaned = cleanPastedSearch(pasted);
      onChange(cleaned);
      if (onImmediateSearch) {
        setTimeout(onImmediateSearch, 0);
      }
    }
  };
}

/**
 * Checks if a candidate field value matches the search query.
 * Both candidate and query are normalized for flexible matching.
 */
export function matchesSearchQuery(
  candidate: string | number | null | undefined,
  query: string
): boolean {
  if (candidate === null || candidate === undefined || !query) return false;
  const rawQuery = query.toLowerCase().trim();
  if (!rawQuery) return true;

  const rawCandidate = String(candidate).toLowerCase().trim();
  if (rawCandidate.includes(rawQuery)) return true;

  const normalizedQuery = normalizeSearchQuery(query);
  const normalizedCandidate = normalizeSearchQuery(String(candidate));

  if (normalizedQuery && normalizedCandidate.includes(normalizedQuery)) return true;

  // Check alphanumeric only (e.g. matching "INV-1001" with "1001" or "INV1001")
  const alphaQuery = rawQuery.replace(/[^a-z0-9]/gi, "");
  const alphaCandidate = rawCandidate.replace(/[^a-z0-9]/gi, "");
  if (alphaQuery && alphaCandidate.includes(alphaQuery)) return true;

  return false;
}

/**
 * Checks if ANY of the candidate fields matches the search query.
 */
export function matchesMultipleFields(
  fields: (string | number | null | undefined)[],
  query: string
): boolean {
  if (!query || !query.trim()) return true;
  return fields.some((field) => matchesSearchQuery(field, query));
}

