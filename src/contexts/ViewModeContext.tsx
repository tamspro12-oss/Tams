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
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
}

// Detect mobile device via User Agent
function isMobileDevice(): boolean {
  return /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Smart device detection for default view mode
function getDefaultViewMode(): ViewMode {
  return isMobileDevice() ? 'mobile' : 'desktop';
}

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const mobile = isMobileDevice();
    const standalone = isStandalonePwa();
    
    // For Mobile PWA: Always force mobile view (ignore old localStorage)
    if (mobile && standalone) {
      localStorage.setItem('viewMode', 'mobile');
      return 'mobile';
    }
    
    // For Desktop PWA: Always force desktop view
    if (!mobile && standalone) {
      localStorage.setItem('viewMode', 'desktop');
      return 'desktop';
    }
    
    // For regular browser: Check localStorage first, then smart detect
    const stored = localStorage.getItem('viewMode');
    if (stored === 'desktop' || stored === 'mobile') {
      return stored;
    }
    
    return getDefaultViewMode();
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem('viewMode', mode);
    // Apply class to body for global styling
    document.body.classList.remove('view-desktop', 'view-mobile');
    document.body.classList.add(`view-${mode}`);
    
    // Dispatch custom event for hooks (like useIsMobile) to react immediately
    window.dispatchEvent(new CustomEvent('viewModeChanged', { detail: mode }));
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'desktop' ? 'mobile' : 'desktop');
  };

  useEffect(() => {
    // Apply initial class
    document.body.classList.add(`view-${viewMode}`);
    return () => {
      document.body.classList.remove('view-desktop', 'view-mobile');
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
