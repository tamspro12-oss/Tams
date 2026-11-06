import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(() => {
    // Check ViewModeContext preference from localStorage on init
    const viewMode = localStorage.getItem('viewMode');
    if (viewMode === 'mobile') return true;
    if (viewMode === 'desktop') return false;
    return undefined;
  });

  React.useEffect(() => {
    const updateMobileState = () => {
      const viewMode = localStorage.getItem('viewMode');
      
      // If user explicitly set view mode, respect it
      if (viewMode === 'mobile') {
        setIsMobile(true);
        return;
      }
      if (viewMode === 'desktop') {
        setIsMobile(false);
        return;
      }
      
      // Default: Use screen width detection
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Initial check
    updateMobileState();

    // Listen for screen size changes (fallback when no explicit preference)
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    mql.addEventListener("change", updateMobileState);

    // Listen for custom viewModeChanged event from ViewModeContext
    const handleViewModeChange = (event: CustomEvent<string>) => {
      if (event.detail === 'mobile') {
        setIsMobile(true);
      } else if (event.detail === 'desktop') {
        setIsMobile(false);
      }
    };

    window.addEventListener('viewModeChanged', handleViewModeChange as EventListener);

    return () => {
      mql.removeEventListener("change", updateMobileState);
      window.removeEventListener('viewModeChanged', handleViewModeChange as EventListener);
    };
  }, []);

  return !!isMobile;
}
