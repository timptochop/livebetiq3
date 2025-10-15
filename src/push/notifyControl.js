// src/push/notifyControl.js
// Συνδέει το καμπανάκι με το Notifications API, χωρίς να αλλάζει κανένα UI.

const STORAGE_KEY = 'lbq.notify';

// Διάβασμα τρέχουσας κατάστασης
export function isNotifyEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

// Κλήση όταν ο χρήστης ανοίγει το καμπανάκι για πρώτη φορά
export async function ensurePermissionIfEnabled() {
  if (!isNotifyEnabled()) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
}

// Προαιρετικό helper για δοκιμή ειδοποίησης από Console
export function testNotify(msg = 'Test notification') {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification('LiveBet IQ', { body: msg });
  }
}

// Αυτό-έκθεση για γρήγορο τεστ
(function expose() {
  window._notify = { isNotifyEnabled, ensurePermissionIfEnabled, testNotify };
})();

// Αν θες να αντιδράς σε αλλαγές τοπικής αποθήκευσης (π.χ. από άλλο tab)
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) ensurePermissionIfEnabled();
});