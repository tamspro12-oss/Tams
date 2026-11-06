import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type ViewMode = 'desktop' | 'mobile';

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

// Detect if running as standalone PWA
function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}

// Detect mobile device via User Agent
function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Automatic responsive view mode detection:
// Desktop screens (>= 768px without mobile user-agent) default to desktop view.
// Mobile screens (< 768px or mobile devices) default to mobile view.
function getAutomaticViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'desktop';
  const isSmallScreen = window.innerWidth < 768;
  if (isMobileDevice() || isSmallScreen) {
    return 'mobile';
  }
  return 'desktop';
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => getAutomaticViewMode());

  const applyViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof document !== 'undefined') {
      document.body.classList.remove('view-desktop', 'view-mobile');
      document.body.classList.add(`view-${mode}`);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('viewModeChanged', { detail: mode }));
    }
  };

  const setViewMode = (mode: ViewMode) => {
    applyViewMode(mode);
  };

  const toggleViewMode = () => {
    applyViewMode(viewMode === 'desktop' ? 'mobile' : 'desktop');
  };

  useEffect(() => {
    // Apply initial responsive view mode
    const initialMode = getAutomaticViewMode();
    applyViewMode(initialMode);

    // Automatically respond to window resize across desktop and mobile screens
    const handleResize = () => {
      const currentMode = getAutomaticViewMode();
      setViewModeState((prev) => {
        if (prev !== currentMode) {
          applyViewMode(currentMode);
          return currentMode;
        }
        return prev;
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (typeof document !== 'undefined') {
        document.body.classList.remove('view-desktop', 'view-mobile');
      }
    };
  }, []);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, toggleViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode must be used within ViewModeProvider');
  }
  return context;
}
