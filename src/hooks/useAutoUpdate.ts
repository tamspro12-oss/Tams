import { useEffect } from "react";

/**
 * Watches Service Worker lifecycle updates without forcefully reloading the page.
 * Emits a safe event so UpdateNotification lets the user choose when to apply the update,
 * ensuring active forms or unsaved entries are never interrupted.
 */
export function useAutoUpdate() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const notifyUpdateCheck = () => {
      window.dispatchEvent(new CustomEvent("tams:check-update"));
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SW_UPDATED") {
        notifyUpdateCheck();
      }
    };

    navigator.serviceWorker.addEventListener("message", handleMessage);

    navigator.serviceWorker.ready
      .then((registration) => {
        registration.update().catch(() => {});

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          notifyUpdateCheck();
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              newWorker.postMessage({ type: "SKIP_WAITING" });
              notifyUpdateCheck();
            }
          });
        });
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleMessage);
    };
  }, []);
}
