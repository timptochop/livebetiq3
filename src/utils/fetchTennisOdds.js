// src/utils/fetchTennisOdds.js

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default async function fetchTennisOdds(opts = {}) {
  const { signal } = opts || {};
  const url = `/api/gs/tennis-odds?ts=${Date.now()}`;

  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
      headers: { Accept: "application/json,text/plain,*/*" },
    });

    if (!res.ok) {
      console.warn("[fetchTennisOdds] non-200 response", res.status, res.statusText);
      return null;
    }

    const text = await res.text();
    if (!text) return null;

    const json = safeJsonParse(text);
    if (!json) {
      console.warn("[fetchTennisOdds] invalid JSON payload (text head):", text.slice(0, 180));
      return null;
    }

    const raw = json && json.raw ? json.raw : null;
    if (!raw) {
      console.warn("[fetchTennisOdds] missing `raw` in response", json);
      return null;
    }

    return raw;
  } catch (err) {
    console.warn("[fetchTennisOdds] fetch failed", err);
    return null;
  }
}