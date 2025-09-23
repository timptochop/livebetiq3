// public/sw.js
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'LiveBet IQ';
    const body = data.body || 'New update';
    const url = data.url || '/';

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        data: { url },
        badge: '/favicon.ico',
        icon: '/favicon.ico',
      })
    );
  } catch (e) {
    // fallback αν δεν είναι JSON
    const text = event.data ? event.data.text() : 'New update';
    event.waitUntil(
      self.registration.showNotification('LiveBet IQ', {
        body: text,
        badge: '/favicon.ico',
        icon: '/favicon.ico',
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  const url = event.notification?.data?.url || '/';
  event.notification.close();
  event.waitUntil(clients.openWindow(url));
});