self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || 'LiveBet IQ';
  const body = data.body || 'Update';
  const url = data.url || '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.PNG',
      badge: '/icon-192.PNG',
      data: { url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { c.navigate(url); return c.focus(); }
    }
    return clients.openWindow(url);
  })());
});