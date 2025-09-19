// src/utils/fetchTennisLive.js
// Try predictions first (has AI labels), otherwise fall back to raw live.

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) {
    const err = new Error(`HTTP ${r.status}`);
    err.status = r.status;
    err.url = url;
    throw err;
  }
  return r.json();
}

export default async function fetchTennisLive() {
  const CANDIDATES = [
    '/api/gs/tennis-predictions', // preferred (AI)
    '/api/gs/tennis-live',        // fallback (no AI or PENDING)
  ];

  for (const url of CANDIDATES) {
    try {
      const data = await getJSON(url);
      const arr = Array.isArray(data?.matches)
        ? data.matches
        : Array.isArray(data)
        ? data
        : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      // move to next candidate
      console.warn('[fetchTennisLive] failed:', e?.url, e?.message || e);
    }
  }

  // last resort
  return [];
}