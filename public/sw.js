self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}

  const title = data.title || 'LiveBet IQ';
  const body  = data.text || data.body || 'Update';
  const url   = data.url  || '/';
  const tag   = data.tag  || 'lbq';
  const icon  = data.icon || '/logo192.png';     // fallback αν δεν έχεις /icon-192.PNG
  const badge = data.badge || '/logo192.png';

  event.waitUntil(
    self.registration.showNotification(title, {
      body, tag, icon, badge,
      data: { url },
      renotify: true,
      silent: false
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      try {
        // Αν είναι ήδη ανοιχτή καρτέλα μας, φέρ’ την μπροστά.
        if ('focus' in c) { await c.focus(); }
        // Προσπάθησε να την πας στο url μας (ίδιο origin).
        if ('navigate' in c) { await c.navigate(url); }
        return;
      } catch {}
    }
    return clients.openWindow(url);
  })());
});