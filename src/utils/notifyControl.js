// src/utils/notifyControl.js
const VAPID = (process.env.REACT_APP_VAPID_PUBLIC_KEY || '').trim();

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getRegistration() {
  if (!('serviceWorker' in navigator)) throw new Error('No service worker support');
  // Αν το SW σου έχει άλλο όνομα/μονοπάτι, άλλαξέ το εδώ:
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  return reg;
}

export async function enableNotifications() {
  if (!VAPID) throw new Error('Missing REACT_APP_VAPID_PUBLIC_KEY');
  const reg = await getRegistration();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID),
  });

  // Στείλε τη συνδρομή στον server (πρέπει να υπάρχει το API route)
  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sub),
  });

  return sub;
}

export async function disableNotifications() {
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  await fetch('/api/unsubscribe', { method: 'POST' }).catch(() => {});
}

export async function isSubscribed() {
  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}