export async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }

  const VAPID = (window.__PUBLIC_VAPID__ || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '').trim();
  if (!VAPID) return { ok: false, reason: 'missing-vapid' };

  const urlB64ToUint8Array = (s) => {
    const p = '='.repeat((4 - (s.length % 4)) % 4);
    const b = (s + p).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(b);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  };

  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID)
    });
  }

  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub })
  }).catch(() => {});

  return { ok: true, subscription: sub };
}