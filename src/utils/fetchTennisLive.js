// File: src/utils/fetchTennisLive.js
const BASE = "/api/gs/tennis-live"; // relative, ώστε να μην έχουμε CORS

export default async function fetchTennisLive({ debug = false } = {}) {
  const url = debug ? `${BASE}?debug=1` : BASE;

  try {
    const r = await fetch(url, { method: "GET" });
    // Δεν εμπιστευόμαστε το status code: το API επιστρέφει πάντα 200 με {error} αν ο πάροχος σκάσει
    const data = await r.json();

    if (data?.error) {
      console.warn("[fetchTennisLive] provider error:", data.error, data.meta || {});
    }

    return Array.isArray(data?.matches) ? data.matches : [];
  } catch (e) {
    console.error("[fetchTennisLive] fetch failed:", e);
    return [];
  }
}

