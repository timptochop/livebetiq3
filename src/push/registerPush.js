// Χρήση στο app όταν θες να κάνεις subscribe+save (π.χ. σε click στο καμπανάκι)

const VAPID_PUBLIC = process.env.REACT_APP_VAPID_PUBLIC_KEY;

// base64 (URL-safe) -> Uint8Array
function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export async function ensurePushSubscribed() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push not supported');
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permission not granted');

  const reg = await navigator.serviceWorker.ready;

  // Αν υπάρχει ήδη
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC)
    });
  }

  // Save στον backend
  const r1 = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub })
  });
  const t1 = await r1.json().catch(() => ({}));
  if (!r1.ok || !t1.ok) throw new Error('subscribe api failed');

  return sub;
}

// helper για άμεσο test push
export async function testPushNow(sub, { title, body, url } = {}) {
  const r2 = await fetch('/api/push/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub,
      title: title || 'LiveBet IQ',
      body: body || 'Test push ✅',
      url: url || location.origin
    })
  });
  const t2 = await r2.json().catch(() => ({}));
  if (!r2.ok || !t2.ok) throw new Error('notify api failed');
  return t2;
}