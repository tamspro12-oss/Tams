/**
 * Canonical Supabase Auth redirect helpers for TAMS Pro.
 * Always resolves to an allowed public HTTPS origin (window.location.origin when valid
 * on tamspro.online / tamspro.vercel.app, otherwise https://tamspro.online).
 * Never emits localhost or legacy retired domains.
 */

export const PRODUCTION_APP_ORIGIN = "https://tamspro.online";

const ALLOWED_WEB_ORIGINS = new Set([
  "https://tamspro.online",
  "https://www.tamspro.online",
  "https://tamspro.vercel.app",
]);

/**
 * Resolves the safe origin to pass to Supabase Auth emailRedirectTo / redirectTo.
 * Never returns localhost, 127.0.0.1, or retired domains; falls back to https://tamspro.online.
 */
export function resolveAuthOrigin(currentOrigin?: string): string {
  const raw = (
    currentOrigin ??
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : PRODUCTION_APP_ORIGIN)
  )
    .trim()
    .replace(/\/+$/, "");

  if (!raw) {
    return PRODUCTION_APP_ORIGIN;
  }

  const lower = raw.toLowerCase();
  if (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("0.0.0.0")
  ) {
    return PRODUCTION_APP_ORIGIN;
  }

  if (ALLOWED_WEB_ORIGINS.has(lower)) {
    return lower;
  }

  return PRODUCTION_APP_ORIGIN;
}

/**
 * Builds the confirmation callback URL for Supabase emailRedirectTo.
 */
export function getAuthCallbackUrl(
  query?: Record<string, string>,
  currentOrigin?: string
): string {
  const base = `${resolveAuthOrigin(currentOrigin)}/auth/callback`;
  if (!query || Object.keys(query).length === 0) {
    return base;
  }
  const params = new URLSearchParams(query);
  return `${base}?${params.toString()}`;
}

/**
 * Builds a redirect URL for password recovery or auth flows on the active allowed origin.
 */
export function getAuthRedirectUrl(path: string, currentOrigin?: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveAuthOrigin(currentOrigin)}${normalizedPath}`;
}
