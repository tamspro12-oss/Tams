// Safe, non-destructive cache refresh mechanism for iOS PWA, Android PWA, and Web.
// Clears only app asset caches (CacheStorage / legacy Service Workers) and reloads safely.
// Never touches Supabase auth sessions, localStorage user preferences/templates, or IndexedDB.

const UPDATE_PARAM = "_tams_v";

export const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

export const isInStandaloneMode = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
};

export const isIOSPWA = () => {
  return isIOS() && isInStandaloneMode();
};

/**
 * Safely appends/replaces a cache-busting query param without breaking existing URL parameters.
 */
export function buildSafeRefreshUrl(currentHref: string, stamp?: number): string {
  const value = String(stamp ?? Date.now());
  try {
    const url = new URL(currentHref);
    url.searchParams.set(UPDATE_PARAM, value);
    return url.toString();
  } catch {
    const separator = currentHref.includes("?") ? "&" : "?";
    return `${currentHref}${separator}${UPDATE_PARAM}=${value}`;
  }
}

/**
 * Cleans up the transient update cache-busting parameter after reload without reloading again.
 */
export function cleanUpdateQueryParam(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(UPDATE_PARAM)) return;
    url.searchParams.delete(UPDATE_PARAM);
    const cleaned = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", cleaned);
  } catch {
    // Ignore history API restrictions
  }
}

export const forceRefresh = async () => {
  try {
    // 1. Clear static asset CacheStorage only (never clears localStorage/auth/IndexedDB user data)
    if (typeof window !== "undefined" && "caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.allSettled(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    // 2. Unregister any legacy service worker
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(registrations.map((reg) => reg.unregister()));
    }

    // 3. Clear only our version marker so the newly loaded version records cleanly
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem("travelpro_app_version");
    }

    // 4. Reload cleanly preserving current route and query params (e.g. ?tab=...)
    if (typeof window !== "undefined") {
      window.location.replace(buildSafeRefreshUrl(window.location.href));
    }
  } catch (error) {
    console.error("[TAMS] Force refresh failed:", error);
    throw error;
  }
};

export const checkForUpdate = async (): Promise<{
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
}> => {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to check version");
    }

    const data = await response.json();
    const currentVersion =
      (typeof localStorage !== "undefined" &&
        localStorage.getItem("travelpro_app_version")) ||
      "0.0.0";

    return {
      hasUpdate: data.version !== currentVersion,
      currentVersion,
      latestVersion: data.version,
    };
  } catch (error) {
    console.error("Version check failed:", error);
    return {
      hasUpdate: false,
      currentVersion: "0.0.0",
      latestVersion: "0.0.0",
    };
  }
};
