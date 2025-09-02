// src/utils/fetchTennisLive.js
// Diagnostic έκδοση: κάνει log μόνο αν υπάρχει ?debug=1 στο URL
const isDebug = (() => {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
})();

async function hit(url) {
  const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`HTTP ${r.status} @ ${url} :: ${txt?.slice(0, 180)}`);
  }
  // προσπαθούμε JSON -> αν αποτύχει, δοκιμάζουμε text και parse
  try {
    return await r.json();
  } catch {
    const t = await r.text();
    if (isDebug) console.log('[fetchTennisLive] text response:', t?.slice(0, 300));
    try {
      return JSON.parse(t);
    } catch {
      throw new Error('Response is not valid JSON');
    }
  }
}

export default async function fetchTennisLive() {
  // Βάλε το σωστό endpoint σου εδώ αν διαφέρει
  const CANDIDATES = [
    '/api/gs/tennis',         // κύριο
    '/api/predictions',       // εναλλακτικό
  ];

  let lastErr = null;
  for (const url of CANDIDATES) {
    try {
      if (isDebug) console.log('[fetchTennisLive] try', url);
      const data = await hit(url);
      // Δεχόμαστε είτε {matches:[...]} είτε [...]
      const arr = Array.isArray(data) ? data : data?.matches;
      if (Array.isArray(arr)) {
        if (isDebug) console.log('[fetchTennisLive] OK from', url, 'count=', arr.length);
        return arr.length ? arr : [];
      }
      if (isDebug) console.log('[fetchTennisLive] shape not array at', url, data);
      // επέστρεψε αντικείμενο; το δίνουμε ωμά για να το χειριστεί ο caller
      return data;
    } catch (e) {
      lastErr = e;
      if (isDebug) console.warn('[fetchTennisLive] fail at', url, e?.message);
    }
  }
  throw lastErr || new Error('No endpoint responded');
}