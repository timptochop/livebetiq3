const BASE_URL = '/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const r = await fetch(BASE_URL, { method: 'GET' });
    if (!r.ok) {
      console.error('[fetchTennisLive] HTTP', r.status);
      return [];
    }
    const data = await r.json();
    return Array.isArray(data?.matches) ? data.matches : [];
  } catch (e) {
    console.error('[fetchTennisLive] Error', e);
    return [];
  }
}