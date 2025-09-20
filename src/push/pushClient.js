// src/push/pushClient.js
// Handles SW registration + PushManager subscription for Web Push.
// Uses VAPID public key from REACT_APP_VAPID_PUBLIC_KEY.

const SUB_KEY = 'lbq_push_sub';
const PUSH_ON_KEY = 'lbq_push_on';

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export function getSavedSubscription() {
  try {
    const s = localStorage.getItem(SUB_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function isPushOn() {
  return localStorage.getItem(PUSH_ON_KEY) === '1';
}

export function setPushOn(v) {
  localStorage.setItem(PUSH_ON_KEY, v ? '1' : '0');
}

export async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission denied');

  // Register SW (served from public/sw.js)
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const pubKey = process.env.REACT_APP_VAPID_PUBLIC_KEY || '';
  if (!pubKey) throw new Error('Missing REACT_APP_VAPID_PUBLIC_KEY');

  // Create subscription
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    localStorage.setItem(SUB_KEY, JSON.stringify(existing));
    setPushOn(true);
    return existing;
  }

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(pubKey)
  });

  localStorage.setItem(SUB_KEY, JSON.stringify(sub));
  setPushOn(true);

  // ping server to send a welcome push (no storage server-side)
  try {
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub, hello: 'welcome' })
    });
  } catch {}
  return sub;
}

export async function disablePush() {
  try {
    const sub = getSavedSubscription();
    setPushOn(false);
    if (!sub) return;

    // unsubscribe in browser
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const s = await reg.pushManager.getSubscription();
      if (s) await s.unsubscribe();
    }
  } finally {
    localStorage.removeItem(SUB_KEY);
  }
}