// src/utils/fetchTennisLive.js
const BASE_URL = '/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const res = await fetch(BASE_URL, { method: 'GET' });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[fetchTennisLive] HTTP', res.status, t.slice(0, 200));
      return [];
    }
    const data = await res.json().catch(() => ({}));
    if (data?.error) console.warn('[fetchTennisLive] API error:', data.error, data.meta || {});
    return Array.isArray(data?.matches) ? data.matches : [];
  } catch (e) {
    console.error('[fetchTennisLive] Exception:', e);
    return [];
  }
}