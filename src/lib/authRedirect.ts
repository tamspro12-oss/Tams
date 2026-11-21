/**
 * Canonical Supabase Auth redirect helpers.
 * Only uses the configured Supabase Redirect URLs:
 *   - https://tamspro.online/auth/callback
 *   - http://localhost:5173/auth/callback
 * plus /reset-password on the matching origin.
 */

export const PRODUCTION_APP_ORIGIN = "https://tamspro.online";
export const LOCAL_DEV_ORIGIN = "http://localhost:5173";

/**
 * Resolves the safe origin to pass to Supabase Auth emailRedirectTo / redirectTo.
 * Falls back to the live production origin if running outside localhost:5173.
 */
export function resolveAuthOrigin(currentOrigin?: string): string {
  const origin =
    currentOrigin ??
    (typeof window !== "undefined" ? window.location.origin : PRODUCTION_APP_ORIGIN);

  if (origin === LOCAL_DEV_ORIGIN) {
    return LOCAL_DEV_ORIGIN;
  }
  return PRODUCTION_APP_ORIGIN;
}

/**
 * Builds the exact confirmation callback URL allowed by Supabase Redirect URLs.
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
