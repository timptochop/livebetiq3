/* Lightweight Web Push SW — δεν πειράζει τίποτα άλλο στο app */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || 'LiveBet IQ';
  const body  = data.body  || 'New update';
  const tag   = data.tag   || 'lbq';
  const icon  = data.icon  || '/logo192.png';
  const badge = data.badge || '/logo192.png';

  event.waitUntil(
    self.registration.showNotification(title, {
      body, tag, icon, badge,
      data: data.clickUrl ? { clickUrl: data.clickUrl } : {},
      renotify: true,
      silent: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.clickUrl || '/';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if (c.url.includes(self.location.origin)) return c.focus(); }
    return clients.openWindow(url);
  })());
});