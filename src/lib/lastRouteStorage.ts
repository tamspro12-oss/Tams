export const DEFAULT_APP_ROUTE = "/app/dashboard";
const LAST_ROUTE_PREFIX = "tams_last_route:";

export function isValidAppRoute(path: string | null | undefined): path is string {
  return typeof path === "string" && path.startsWith("/app/") && !path.startsWith("//");
}

export function saveLastAppRoute(
  userId: string | null | undefined,
  pathname: string,
  search: string = ""
): void {
  if (typeof window === "undefined" || !userId || !isValidAppRoute(pathname)) return;
  try {
    localStorage.setItem(`${LAST_ROUTE_PREFIX}${userId}`, `${pathname}${search || ""}`);
  } catch {
    // Ignore storage quota or privacy errors
  }
}

export function getLastAppRoute(
  userId: string | null | undefined,
  fallback: string = DEFAULT_APP_ROUTE
): string {
  if (typeof window === "undefined" || !userId) return fallback;
  try {
    const saved = localStorage.getItem(`${LAST_ROUTE_PREFIX}${userId}`);
    if (saved && isValidAppRoute(saved)) {
      return saved;
    }
  } catch {
    // Ignore storage access errors
  }
  return fallback;
}

export function clearLastAppRoute(userId?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.removeItem(`${LAST_ROUTE_PREFIX}${userId}`);
    }
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LAST_ROUTE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage access errors
  }
}

interface LocationLike {
  pathname?: string;
  search?: string;
  hash?: string;
}

export function resolvePostLoginRoute(state: unknown, userId?: string | null): string {
  const from = (state as { from?: LocationLike } | null)?.from;
  if (from && isValidAppRoute(from.pathname)) {
    return `${from.pathname}${from.search || ""}${from.hash || ""}`;
  }
  return getLastAppRoute(userId, DEFAULT_APP_ROUTE);
}

