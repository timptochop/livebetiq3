// src/utils/fetchTennisLive.js
export default async function fetchTennisLive({ debug = false } = {}) {
  const url = debug ? '/api/gs/tennis-live?debug=1' : '/api/gs/tennis-live';

  try {
    const r = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' }, cache: 'no-store' });
    if (!r.ok) {
      console.warn('[fetchTennisLive] HTTP', r.status, r.statusText);
      return [];
    }
    const data = await r.json();
    if (data?.error) console.warn('[fetchTennisLive] API error:', data.error, data.meta || {});
    const arr = Array.isArray(data?.matches) ? data.matches : [];
    return arr;
  } catch (e) {
    console.error('[fetchTennisLive] Network error:', e);
    return [];
  }
}