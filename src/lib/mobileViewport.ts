/**
 * Mobile viewport & virtual keyboard helper (strictly no-op on >= 768px desktop).
 * Keeps `--mobile-vvh` synchronized with window.visualViewport height so dialogs
 * and sticky forms fit cleanly above the soft keyboard on iOS / Android / Capacitor,
 * and scrolls newly focused form controls into view below 768px.
 */
export function initMobileViewport(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const mql = window.matchMedia("(max-width: 767px)");
  const root = document.documentElement;
  let scrollTimer: number | undefined;

  const updateViewportHeight = () => {
    if (!mql.matches) {
      root.style.removeProperty("--mobile-vvh");
      return;
    }
    const vvh = window.visualViewport?.height ?? window.innerHeight;
    root.style.setProperty("--mobile-vvh", `${Math.round(vvh)}px`);
  };

  const handleFocusIn = (event: FocusEvent) => {
    if (!mql.matches) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;

    if (scrollTimer !== undefined) {
      window.clearTimeout(scrollTimer);
    }
    scrollTimer = window.setTimeout(() => {
      updateViewportHeight();
      try {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch {
        target.scrollIntoView({ block: "center" });
      }
    }, 180);
  };

  updateViewportHeight();

  window.visualViewport?.addEventListener("resize", updateViewportHeight);
  window.visualViewport?.addEventListener("scroll", updateViewportHeight);
  window.addEventListener("resize", updateViewportHeight);
  mql.addEventListener("change", updateViewportHeight);
  document.addEventListener("focusin", handleFocusIn, { passive: true });

  return () => {
    if (scrollTimer !== undefined) {
      window.clearTimeout(scrollTimer);
    }
    window.visualViewport?.removeEventListener("resize", updateViewportHeight);
    window.visualViewport?.removeEventListener("scroll", updateViewportHeight);
    window.removeEventListener("resize", updateViewportHeight);
    mql.removeEventListener("change", updateViewportHeight);
    document.removeEventListener("focusin", handleFocusIn);
    root.style.removeProperty("--mobile-vvh");
  };
}

