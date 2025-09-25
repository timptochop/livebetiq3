// src/push/pushClient.js
const VAPID_PUBLIC = process.env.REACT_APP_VAPID_PUBLIC_KEY;

export async function registerSW() {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker not supported');
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

export async function ensurePermission() {
  if (!('Notification' in window)) throw new Error('Notification API not supported');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permission denied');
}

export async function getSubscription(reg) {
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
    });
  }
  return sub;
}

export async function saveSubscription(sub) {
  const r = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub })
  });
  return r.ok;
}

export async function sendNotify({ subscription, title, text, url, tag }) {
  const r = await fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription, title, text, url, tag })
  });
  return r.ok;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}