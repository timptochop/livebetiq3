// src/utils/fetchTennisLive.js
const BASE_URL = '/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const res = await fetch(BASE_URL, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[fetchTennisLive] HTTP', res.status, text);
      return [];
    }
    const data = await res.json();
    if (!data?.ok || !Array.isArray(data.matches)) {
      console.warn('[fetchTennisLive] Unexpected payload:', data);
      return [];
    }
    return data.matches;
  } catch (e) {
    console.error('[fetchTennisLive] Network/API Error:', e);
    return [];
  }
}