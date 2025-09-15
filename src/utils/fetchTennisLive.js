// src/utils/fetchTennisLive.js
const BASE_URL = '/api/gs/tennis-live';

export default async function fetchTennisLive() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
    const res = await fetch(BASE_URL, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      cache: 'no-store',
      signal: ctrl.signal,
    });

    if (!res.ok) return [];

    const data = await res.json();
    const matches = Array.isArray(data?.matches) ? data.matches : [];
    return matches;
  } catch (_e) {
    // σιωπηλό fallback — απλά άδειος πίνακας
    return [];
  } finally {
    clearTimeout(timer);
  }
}