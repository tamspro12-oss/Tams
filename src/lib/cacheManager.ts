import { QueryClient } from "@tanstack/react-query";

let globalQueryClient: QueryClient | null = null;

export function registerGlobalQueryClient(client: QueryClient) {
  globalQueryClient = client;
}

/**
 * Strict data isolation: Clear all cached data on logout and on login,
 * ensuring a second user on the same browser never sees the previous agency's data.
 */
export function clearAllAgencyDataCache() {
  // 1. Clear React Query in-memory cache
  if (globalQueryClient) {
    try {
      globalQueryClient.clear();
      globalQueryClient.cancelQueries();
    } catch (e) {
      console.warn("[CacheManager] Error clearing React Query cache:", e);
    }
  }

  // 2. Clear cached application and agency data in localStorage
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // Retain device_id and theme, wipe all domain and tenant cached data
      if (
        key === "travelpro_session" ||
        key.startsWith("tams_") ||
        key.startsWith("offline_") ||
        key.includes("cache") ||
        key.includes("ledger") ||
        key.includes("parties") ||
        key.includes("invoices")
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn("[CacheManager] Error clearing localStorage:", err);
  }

  // 3. Clear sessionStorage
  try {
    sessionStorage.clear();
  } catch (err) {
    console.warn("[CacheManager] Error clearing sessionStorage:", err);
  }
}
