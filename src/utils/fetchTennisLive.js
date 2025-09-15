// src/utils/fetchTennisLive.js
const BASE_URL = '/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const r = await fetch(BASE_URL, { method: 'GET' });
    if (!r.ok) {
      console.warn('[fetchTennisLive] HTTP', r.status);
      return [];
    }
    const data = await r.json();
    if (!data || !Array.isArray(data.matches)) return [];
    return data.matches;
  } catch (e) {
    console.error('[fetchTennisLive] Error', e);
    return [];
  }
}