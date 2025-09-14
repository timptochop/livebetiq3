// src/utils/fetchTennisLive.js
const BASE_URL = '/api/gs/tennis-live';

export default async function fetchTennisLive() {
  try {
    const res = await fetch(BASE_URL, { method: 'GET' });
    const data = await res.json().catch(() => ({}));

    if (!data?.ok) {
      console.error('[fetchTennisLive] API returned error:', data?.error);
      return [];
    }
    return Array.isArray(data.matches) ? data.matches : [];
  } catch (e) {
    console.error('[fetchTennisLive] Network/API Error:', e);
    return [];
  }
}