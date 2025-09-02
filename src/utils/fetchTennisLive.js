// src/utils/fetchTennisLive.js
export default async function fetchTennisPredictions() {
  try {
    const res = await fetch('/api/predictions', { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const matches = Array.isArray(data?.matches) ? data.matches : [];
    return matches;
  } catch (err) {
    console.error('fetchTennisPredictions error:', err?.message || err);
    return [];
  }
}