// src/utils/fetchTennisLive.js
export default async function fetchTennisLive(opts = {}) {
  const { signal } = opts;

  const url = `/api/gs/tennis-live?ts=${Date.now()}`;

  const res = await fetch(url, {
    method: 'GET',
    credentials: 'same-origin',
    signal,
  });

  if (!res.ok) {
    throw new Error(`[fetchTennisLive] http ${res.status}`);
  }

  const json = await res.json();
  const matches = Array.isArray(json && json.matches) ? json.matches : [];

  return matches;
}