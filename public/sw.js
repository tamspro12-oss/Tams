// TAMS kill-switch service worker.
// Purpose: recover devices stuck on a stale cached app shell by wiping this
// SW's own caches, reloading open tabs, and unregistering itself. Runs once
// per device, then the site loads normally from the network on next visit.

function isOwnAppCache(name) {
  // Only touch caches this app SW created. Leave any Firebase/OneSignal/etc caches alone.
  return /^tams-cache-|^tams-v/.test(name);
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        const ours = names.filter(isOwnAppCache);
        await Promise.allSettled(ours.map((n) => caches.delete(n)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: 'window' });
        await Promise.allSettled(windowClients.map((c) => c.navigate(c.url)));
      } finally {
        await self.registration.unregister();
      }
    })()
  )
);

// No fetch handler — requests go straight to the network.
