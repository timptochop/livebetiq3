// src/push/registerPush.js
function urlB64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * Κάνει request permission, κάνει subscribe στο PushManager,
 * και στέλνει τη συνδρομή στο backend (/api/push/subscribe).
 */
export async function registerPush() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { ok: false, reason: 'unsupported' };
    }

    // Ζήτα άδεια αν δεν είναι ήδη granted
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        return { ok: false, reason: 'denied' };
      }
    }

    // Περιμένουμε να είναι έτοιμος ο service worker
    const reg = await navigator.serviceWorker.ready;

    // Παίρνουμε το public key από env
    const key =
      (window.__VAPID__ || process.env.REACT_APP_VAPID_PUBLIC_KEY || '').trim();

    if (!key) {
      return { ok: false, reason: 'missing_vapid_key' };
    }

    // Subscribe
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(key),
    });

    // Σώσε στο backend
    const save = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    });

    return { ok: save.ok, status: save.status, subscription };
  } catch (err) {
    console.error('registerPush error', err);
    return { ok: false, error: String(err) };
  }
}