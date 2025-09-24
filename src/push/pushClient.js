// src/push/pushClient.js
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function ensureSW() {
  if (!('serviceWorker' in navigator)) return null;
  const reg = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

export function permissionState() {
  return Notification?.permission || 'denied';
}

export async function askPermission() {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'default') {
    try { return await Notification.requestPermission(); }
    catch { return Notification.permission; }
  }
  return Notification.permission;
}

export async function getSubscription() {
  const reg = await ensureSW();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function subscribe() {
  const reg = await ensureSW();
  if (!reg) throw new Error('No service worker');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
  });
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sub)
  });
  return sub;
}

export async function unsubscribe() {
  const sub = await getSubscription();
  if (!sub) return false;
  try {
    await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`, { method: 'DELETE' });
  } catch {}
  return sub.unsubscribe();
}