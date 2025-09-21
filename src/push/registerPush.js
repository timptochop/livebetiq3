// src/push/registerPush.js
//
// Default export to match: import registerPush from './push/registerPush'
//
// What it does:
// 1) Checks feature support (SW + Push + Notification)
// 2) Gets VAPID public key (CRA-friendly):
//    - process.env.REACT_APP_VAPID_PUBLIC_KEY
//    - process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
//    - GET /api/push/notify -> { publicKey }
// 3) Registers /sw.js
// 4) Subscribes to PushManager with the VAPID key
// 5) POSTs the subscription to /api/push/subscribe
// 6) Returns true on success, false otherwise

function base64UrlToUint8Array(base64String) {
  // ensure padding
  const pad = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getVapidPublicKey() {
  // CRA exposes only REACT_APP_* at build time
  let key =
    process.env.REACT_APP_VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    '';

  if (key && typeof key === 'string' && key.length > 30) {
    return key.trim();
  }

  // Fallback: ask the server (we added /api/push/notify in phase-7)
  try {
    const r = await fetch('/api/push/notify', { method: 'GET', credentials: 'same-origin' });
    if (r.ok) {
      const j = await r.json();
      if (j && (j.publicKey || j.key)) {
        return String(j.publicKey || j.key).trim();
      }
    }
  } catch (e) {
    // ignore
  }
  return '';
}

export default async function registerPush() {
  try {
    if (!('serviceWorker' in navigator)) {
      console.warn('[push] serviceWorker not supported');
      return false;
    }
    if (!('PushManager' in window)) {
      console.warn('[push] PushManager not supported');
      return false;
    }
    if (!('Notification' in window)) {
      console.warn('[push] Notification API not supported');
      return false;
    }

    // Permission
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.warn('[push] permission not granted:', perm);
      return false;
    }

    // VAPID key
    const publicKey = await getVapidPublicKey();
    if (!publicKey) {
      console.error('[push] missing VAPID public key');
      return false;
    }

    // Register SW
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready; // ensure active

    // Existing subscription?
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToUint8Array(publicKey),
      });
    }

    if (!sub) {
      console.error('[push] failed to obtain subscription');
      return false;
    }

    // Send subscription to backend
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ subscription: sub }),
    });

    if (!res.ok) {
      console.error('[push] subscribe API failed:', res.status);
      return false;
    }

    console.log('[push] subscription OK');
    return true;
  } catch (err) {
    console.error('[push] register failed:', err);
    return false;
  }
}