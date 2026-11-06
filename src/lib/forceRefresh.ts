// Force refresh mechanism for iOS PWA and all platforms
// Clears all caches and forces a complete app reload

export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

export const isInStandaloneMode = () => {
  return (window.matchMedia('(display-mode: standalone)').matches) || 
         (window.navigator as any).standalone === true;
};

export const isIOSPWA = () => {
  return isIOS() && isInStandaloneMode();
};

export const forceRefresh = async () => {
  try {
    console.log('🔄 Starting force refresh...');
    
    // Step 1: Clear all caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log(`📦 Clearing ${cacheNames.length} caches...`);
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
      console.log('✅ All caches cleared');
    }

    // Step 2: Unregister service worker
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`🔧 Unregistering ${registrations.length} service workers...`);
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('✅ Service workers unregistered');
    }

    // Step 3: Clear local storage version data (force version check on next load)
    localStorage.removeItem('travelpro_app_version');
    console.log('✅ Version cache cleared');

    // Step 4: Force hard reload with cache bypass
    console.log('🔄 Forcing hard reload...');
    
    if (isIOSPWA()) {
      // For iOS PWA, we need to reload and then show instructions
      // because iOS doesn't fully reload PWAs without closing/reopening
      window.location.reload();
      
      // After reload, show alert (will only show if reload didn't work)
      setTimeout(() => {
        alert('For iOS: Please close this app completely and reopen it from your home screen to complete the update.');
      }, 1000);
    } else {
      // For web and Android PWA, hard reload works
      window.location.href = window.location.href + '?v=' + Date.now();
    }
    
  } catch (error) {
    console.error('❌ Force refresh failed:', error);
    throw error;
  }
};

export const checkForUpdate = async (): Promise<{ hasUpdate: boolean; currentVersion: string; latestVersion: string }> => {
  try {
    const response = await fetch('/api/version?t=' + Date.now(), {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to check version');
    }
    
    const data = await response.json();
    const currentVersion = localStorage.getItem('travelpro_app_version') || '0.0.0';
    
    return {
      hasUpdate: data.version !== currentVersion,
      currentVersion,
      latestVersion: data.version
    };
  } catch (error) {
    console.error('Version check failed:', error);
    return {
      hasUpdate: false,
      currentVersion: '0.0.0',
      latestVersion: '0.0.0'
    };
  }
};
