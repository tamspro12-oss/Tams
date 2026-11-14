import { QueryClient } from "@tanstack/react-query";

let globalQueryClient: QueryClient | null = null;

export function registerGlobalQueryClient(client: QueryClient) {
  globalQueryClient = client;
}

const PRESERVED_UI_PREF_KEYS = new Set([
  "theme",
  "tams_theme",
  "vite-ui-theme",
  "device_id",
  "sidebar:state",
]);

/**
 * Strict multi-tenant isolation: Clear all cached domain & agency data from React Query,
 * localStorage (preserving only UI theme/sidebar/device preferences), and sessionStorage
 * on logout and before/on login so another agency never sees leftover data.
 */
export function clearAllAgencyDataCache() {
  if (globalQueryClient) {
    try {
      globalQueryClient.cancelQueries();
      globalQueryClient.clear();
    } catch (e) {
      console.warn("[CacheManager] Error clearing React Query cache:", e);
    }
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Leave Supabase GoTrue auth storage intact when called during active sign-in,
      // and preserve pure UI preferences; remove everything else.
      if (PRESERVED_UI_PREF_KEYS.has(key) || key.startsWith("sb-")) {
        continue;
      }
      keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn("[CacheManager] Error clearing localStorage:", err);
  }

  try {
    sessionStorage.clear();
  } catch (err) {
    console.warn("[CacheManager] Error clearing sessionStorage:", err);
  }
}
