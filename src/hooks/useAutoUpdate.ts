import { useEffect } from 'react';

export function useAutoUpdate() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    // Listen for service worker update messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        console.log('🚀 Auto-updating app to:', event.data.version);
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    // Check for updates and activate waiting service worker
    navigator.serviceWorker.ready.then((registration) => {
      // Trigger update check
      registration.update().catch(console.error);

      // If there's a waiting service worker, activate it
      if (registration.waiting) {
        console.log('[AutoUpdate] Activating waiting service worker');
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // Watch for new service workers
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[AutoUpdate] New version ready, activating...');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    }).catch(console.error);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);
}
