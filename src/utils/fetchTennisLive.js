// src/utils/fetchTennisLive.js

export async function fetchTennisPredictions() {
  try {
    const res = await fetch('/api/gs/tennis-predictions', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const matches = Array.isArray(json?.matches) ? json.matches : [];
    if (matches.length > 0) return matches;
    return await fallbackLive();
  } catch (err) {
    console.error("⚠️ fetchTennisPredictions error:", err.message);
    return await fallbackLive();
  }
}

async function fallbackLive() {
  try {
    const res = await fetch('/api/gs/tennis-live', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const base = Array.isArray(json?.matches) ? json.matches : [];
    return base.map((m) => ({
      ...m,
      prediction: {
        label: 'PENDING',
        pick: null,
        confidence: 0,
        source: 'fallback',
        detail: 'set1_pending',
      },
    }));
  } catch (err) {
    console.error("⚠️ fallbackLive error:", err.message);
    return [];
  }
}

export async function fetchTennisLive() {
  const res = await fetch('/api/gs/tennis-live', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json?.matches) ? json.matches : [];
}

// ✅ Default export
export default fetchTennisPredictions;