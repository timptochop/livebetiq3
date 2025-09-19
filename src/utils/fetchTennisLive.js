// src/utils/fetchTennisLive.js
// Robust fetcher. Can run in 'live-only' mode to bypass broken predictions API.

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/**
 * mode:
 *  - 'live-only'         -> only /api/gs/tennis-live
 *  - 'pred-then-live'    -> try predictions first, fallback to live (default)
 */
export default async function fetchTennisLive(mode = 'pred-then-live') {
  const urls = mode === 'live-only'
    ? ['/api/gs/tennis-live']
    : ['/api/gs/tennis-predictions', '/api/gs/tennis-live'];

  for (const url of urls) {
    try {
      const data = await getJSON(url);
      const arr = Array.isArray(data?.matches)
        ? data.matches
        : (Array.isArray(data) ? data : []);
      return arr; // always an Array
    } catch (e) {
      console.warn(`[fetchTennisLive] failed: ${url} - ${(e && e.message) || e}`);
      // try next URL
    }
  }
  return [];
}