// src/utils/fetchTennisLive.js
// Try predictions first (has AI labels). Fallback to plain live feed.
// Never throw to the UI; always resolve to an array.

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default async function fetchTennisLive() {
  const CANDIDATES = [
    '/api/gs/tennis-predictions', // might 500
    '/api/gs/tennis-live',        // fallback
  ];

  for (const url of CANDIDATES) {
    try {
      const data = await getJSON(url);
      const arr = Array.isArray(data?.matches)
        ? data.matches
        : (Array.isArray(data) ? data : []);
      if (Array.isArray(arr)) return arr;
    } catch (e) {
      // keep trying next; just log for visibility
      // eslint-disable-next-line no-console
      console.warn('[fetchTennisLive] failed:', url, e?.message || e);
    }
  }
  return []; // never propagate failure
}