// src/utils/fetchTennisLive.js
// Try predictions first; if it 500/throws, fall back to live quietly.

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default async function fetchTennisLive() {
  const CANDIDATES = [
    '/api/gs/tennis-predictions', // AI predictions
    '/api/gs/tennis-live',        // fallback (no AI / or PENDING)
  ];

  for (const url of CANDIDATES) {
    try {
      const data = await getJSON(url);
      const arr = Array.isArray(data?.matches) ? data.matches
                : Array.isArray(data) ? data : [];
      return arr;
    } catch {
      // swallow and try next, no console noise
    }
  }
  return [];
}