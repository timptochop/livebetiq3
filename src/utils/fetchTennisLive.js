// src/utils/fetchTennisLive.js
export default async function fetchTennisLive(opts = {}) {
  const { signal } = opts;

  // κύριο endpoint (ίδιο origin)
  const url = `/api/tennis-live?ts=${Date.now()}`;

  let res = await fetch(url, { method: 'GET', credentials: 'same-origin', signal });
  if (!res.ok) throw new Error(`[fetchTennisLive] http ${res.status}`);

  const json = await res.json();
  const matches = Array.isArray(json?.matches) ? json.matches : [];

  return matches;
}