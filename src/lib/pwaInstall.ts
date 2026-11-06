// src/lib/pwaInstall.ts
// Handles beforeinstallprompt, appinstalled, display-mode detection, layout control

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const INSTALL_KEY = 'tams_pwa_installed_v1';
const ONBOARD_KEY = 'tams_pwa_onboard_shown_v1';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaInstallOptions {
  onInstall?: () => void;
  onShowDesktopLayout?: () => void;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function isMobileDevice(): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function shouldForceDesktopLayout(): boolean {
  // Simple: Desktop = desktop view, Mobile = mobile view
  return !isMobileDevice();
}

export function isDesktopBrowser(): boolean {
  return window.innerWidth >= 900 && !/Mobi|Android/i.test(navigator.userAgent);
}

export function isSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  return /Safari/.test(ua) && !/Chrome/.test(ua) && !/CriOS/.test(ua);
}

export function canShowInstallPrompt(): boolean {
  return deferredPrompt !== null;
}

export function hasBeenInstalled(): boolean {
  try {
    return localStorage.getItem(INSTALL_KEY) === 'true';
  } catch {
    return false;
  }
}

export function hasShownOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARD_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setOnboardingShown(): void {
  try {
    localStorage.setItem(ONBOARD_KEY, 'true');
  } catch {}
}

export function initPwaInstall(options: PwaInstallOptions = {}) {
  const { onInstall = () => {}, onShowDesktopLayout = () => {} } = options;

  function applyLayout() {
    if (isMobileDevice()) {
      // Mobile device = mobile layout (any browser or PWA)
      document.documentElement.classList.add('tams-pwa-mobile');
      document.documentElement.classList.remove('tams-pwa-desktop');
    } else {
      // Desktop device = desktop layout (any browser or PWA)
      document.documentElement.classList.add('tams-pwa-desktop');
      document.documentElement.classList.remove('tams-pwa-mobile');
      onShowDesktopLayout();
    }
  }

  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('tams:beforeinstallprompt'));
  });

  // Listen for app installed event
  window.addEventListener('appinstalled', () => {
    try {
      localStorage.setItem(INSTALL_KEY, 'true');
    } catch {}
    deferredPrompt = null;
    onInstall();
    applyLayout();
    window.dispatchEvent(new CustomEvent('tams:appinstalled'));
  });

  // Apply layout on init and resize
  applyLayout();
  window.addEventListener('resize', applyLayout);

  return {
    isStandalone,
    shouldForceDesktopLayout,
    canShowInstallPrompt,
  };
}

export async function promptInstall(): Promise<{ outcome: string; error?: Error }> {
  if (!deferredPrompt) {
    return { outcome: 'no_event' };
  }

  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('tams:afterinstallprompt', { detail: choice }));
    return choice;
  } catch (err) {
    console.warn('PWA prompt failed', err);
    return { outcome: 'error', error: err as Error };
  }
}
