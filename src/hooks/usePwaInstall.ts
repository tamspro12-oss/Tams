// src/hooks/usePwaInstall.ts
import { useEffect, useState, useCallback } from 'react';
import {
  isStandalone,
  isAppInstalled,
  isDesktopBrowser,
  isSafariBrowser,
  isMobileDevice,
  isIOSDevice,
  isAndroidDevice,
  hasBeenInstalled,
  hasShownOnboarding,
  setOnboardingShown,
  canShowInstallPrompt,
  promptInstall,
} from '@/lib/pwaInstall';

interface UsePwaInstallReturn {
  canInstall: boolean;
  isInstalled: boolean;
  isStandaloneApp: boolean;
  isDesktopPwa: boolean;
  isSafari: boolean;
  isDesktop: boolean;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  showOnboarding: boolean;
  triggerInstall: () => Promise<{ outcome: string }>;
  dismissOnboarding: () => void;
}

export function usePwaInstall(): UsePwaInstallReturn {
  const [canInstall, setCanInstall] = useState(() => canShowInstallPrompt());
  const [isInstalled, setIsInstalled] = useState(() => hasBeenInstalled() || isAppInstalled());
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => isAppInstalled());
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (isStandalone() && !hasShownOnboarding()) {
      setShowOnboarding(true);
    }

    function onBeforeInstall() {
      setCanInstall(true);
      setIsInstalled(false);
    }

    function onAppInstalled() {
      setCanInstall(false);
      setIsInstalled(true);
      setIsStandaloneApp(isAppInstalled());
    }

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = () => {
      const appInstalled = isAppInstalled();
      setIsStandaloneApp(appInstalled);
      if (appInstalled) {
        setIsInstalled(true);
      }
    };

    window.addEventListener('tams:beforeinstallprompt', onBeforeInstall);
    window.addEventListener('tams:appinstalled', onAppInstalled);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', onDisplayModeChange);
    }

    return () => {
      window.removeEventListener('tams:beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('tams:appinstalled', onAppInstalled);
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', onDisplayModeChange);
      }
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    setCanInstall(false);
    const result = await promptInstall();
    if (result.outcome !== 'accepted') {
      setCanInstall(canShowInstallPrompt());
    } else {
      setIsInstalled(true);
    }
    return result;
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setOnboardingShown();
  }, []);

  return {
    canInstall,
    isInstalled,
    isStandaloneApp,
    isDesktopPwa: isStandalone() && isDesktopBrowser(),
    isSafari: isSafariBrowser(),
    isDesktop: isDesktopBrowser(),
    isMobile: isMobileDevice(),
    isIOS: isIOSDevice(),
    isAndroid: isAndroidDevice(),
    showOnboarding,
    triggerInstall,
    dismissOnboarding,
  };
}
