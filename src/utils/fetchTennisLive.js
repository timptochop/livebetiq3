// src/utils/fetchTennisLive.js
const BASE_URL = '/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const res = await fetch(BASE_URL, { method: 'GET' });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      console.error('[fetchTennisLive] HTTP', res.status, msg.slice(0, 200));
      return [];
    }
    // περιμένουμε JSON
    if (!ct.includes('application/json')) {
      const t = await res.text().catch(() => '');
      console.warn('[fetchTennisLive] Unexpected content-type:', ct, t.slice(0, 120));
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data?.matches)) return data.matches;

    if (data?.error) {
      console.warn('[fetchTennisLive] API error:', data.error);
    }
    return [];
  } catch (e) {
    console.error('[fetchTennisLive] Exception:', e);
    return [];
  }
}