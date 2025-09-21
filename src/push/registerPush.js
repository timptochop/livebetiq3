// src/push/registerPush.js
export default async function registerPush() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error('[registerPush] failed:', err);
    return null;
  }
}