// src/push/registerPush.js
// Registers SW, asks Notification permission, subscribes to Push, and triggers a test push.

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const outputArray = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) outputArray[i] = raw.charCodeAt(i);
  return outputArray;
}

export async function enableWebPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      console.warn('[push] Not supported in this browser');
      return { ok: false, reason: 'not_supported' };
    }

    // Ask permission
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.warn('[push] Permission denied');
      return { ok: false, reason: 'denied' };
    }

    // Register SW
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    // Get VAPID public key from env (CRA exposes REACT_APP_* at build time)
    const pubKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
    if (!pubKey) {
      console.error('[push] Missing REACT_APP_VAPID_PUBLIC_KEY');
      return { ok: false, reason: 'missing_public_key' };
    }

    // Subscribe
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pubKey),
    });

    // Fire a test push via serverless function (no DB needed)
    await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subscription: sub,
        title: 'LiveBet IQ',
        body: 'Push is ON — you will get SAFE alerts.',
        url: '/',
      }),
    }).catch(() => {});

    return { ok: true };
  } catch (e) {
    console.error('[push] enable error:', e);
    return { ok: false, reason: 'error', error: e?.message };
  }
}