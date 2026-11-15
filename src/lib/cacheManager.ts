import { QueryClient } from "@tanstack/react-query";
import { shouldPreserveStorageKeyOnClear } from "@/lib/templateStorageKeys";

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
 * localStorage (preserving UI preferences AND any template not yet uploaded to the DB),
 * and sessionStorage on logout and before/on login so another agency never sees leftover data.
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
      if (shouldPreserveStorageKeyOnClear(key, localStorage, PRESERVED_UI_PREF_KEYS)) {
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
