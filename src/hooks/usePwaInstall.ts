// src/hooks/usePwaInstall.ts
import { useEffect, useState, useCallback } from 'react';
import {
  isStandalone,
  isDesktopBrowser,
  isSafariBrowser,
  isMobileDevice,
  hasBeenInstalled,
  hasShownOnboarding,
  setOnboardingShown,
  promptInstall,
} from '@/lib/pwaInstall';

interface UsePwaInstallReturn {
  canInstall: boolean;
  isInstalled: boolean;
  isDesktopPwa: boolean;
  isSafari: boolean;
  isDesktop: boolean;
  showOnboarding: boolean;
  triggerInstall: () => Promise<{ outcome: string }>;
  dismissOnboarding: () => void;
}

export function usePwaInstall(): UsePwaInstallReturn {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => hasBeenInstalled() || isStandalone());
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if we should show onboarding (standalone mode + not shown before)
    if (isStandalone() && !hasShownOnboarding()) {
      setShowOnboarding(true);
    }

    // Listen for beforeinstallprompt
    function onBeforeInstall() {
      setCanInstall(true);
    }

    // Listen for app installed
    function onAppInstalled() {
      setCanInstall(false);
      setIsInstalled(true);
    }

    window.addEventListener('tams:beforeinstallprompt', onBeforeInstall);
    window.addEventListener('tams:appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('tams:beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('tams:appinstalled', onAppInstalled);
    };
  }, []);

  const triggerInstall = useCallback(async () => {
    setCanInstall(false);
    const result = await promptInstall();
    if (result.outcome !== 'accepted') {
      // User dismissed, allow showing button again
      setCanInstall(true);
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
    isDesktopPwa: isStandalone() && isDesktopBrowser(),
    isSafari: isSafariBrowser(),
    isDesktop: isDesktopBrowser(),
    showOnboarding,
    triggerInstall,
    dismissOnboarding,
  };
}
