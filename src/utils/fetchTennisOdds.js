// src/utils/fetchTennisOdds.js

export default async function fetchTennisOdds(opts = {}) {
  const { signal } = opts || {};

  const url = `/api/gs/tennis-odds?ts=${Date.now()}`;

  const res = await fetch(url, {
    method: "GET",
    credentials: "same-origin",
    signal,
  });

  if (!res.ok) {
    console.warn(
      "[fetchTennisOdds] non-200 response",
      res.status,
      res.statusText
    );
    return null;
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    console.warn("[fetchTennisOdds] failed to parse JSON", err);
    return null;
  }

  const raw = json && json.raw ? json.raw : null;
  if (!raw) {
    console.warn("[fetchTennisOdds] missing `raw` in response", json);
  }

  return raw;
}