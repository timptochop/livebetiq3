/* public/sw.js */
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  self.clients.claim();
});

// Show notification when a push arrives
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || 'LiveBet IQ';
  const body = data.body || 'New update';
  const icon = data.icon || '/favicon.ico';
  const badge = data.badge || '/favicon.ico';
  const url = data.url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url }
    })
  );
});

// Focus/open app when user clicks the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      // focus existing tab
      if (client.url.includes(self.location.origin)) {
        client.focus();
        return;
      }
    }
    // or open a new one
    await clients.openWindow(url);
  })());
});