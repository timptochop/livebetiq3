// src/utils/fetchTennisLive.js
const ENDPOINT = '/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP_${r.status}`);
    const data = await r.json();
    const arr = Array.isArray(data?.matches) ? data.matches : [];
    return arr;
  } catch (e) {
    console.warn('[fetchTennisLive] API error:', e?.message);
    return [];
  }
}