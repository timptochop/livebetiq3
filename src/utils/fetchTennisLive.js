// src/utils/fetchTennisLive.js

const isDebug = (() => {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
})();

async function hit(url) {
  const r = await fetch(url, { headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    throw new Error(`HTTP ${r.status} @ ${url} :: ${txt?.slice(0, 180)}`);
  }

  try {
    return await r.json();
  } catch {
    const t = await r.text();
    if (isDebug) console.log('[fetchTennisLive] text response:', t?.slice(0, 300));
    try {
      return JSON.parse(t);
    } catch {
      throw new Error('Response is not valid JSON');
    }
  }
}

export default async function fetchTennisLive() {
  const CANDIDATES = [
    '/api/gs/tennis-live' // ✅ correct endpoint
  ];

  let lastErr = null;
  for (const url of CANDIDATES) {
    try {
      if (isDebug) console.log('[fetchTennisLive] try', url);
      const data = await hit(url);
      const arr = Array.isArray(data) ? data : data?.matches;
      if (Array.isArray(arr)) {
        if (isDebug) console.log('[fetchTennisLive] OK from', url, 'count=', arr.length);
        return arr.length ? arr : [];
      }
      if (isDebug) console.log('[fetchTennisLive] shape not array at', url, data);
      return data;
    } catch (e) {
      lastErr = e;
      if (isDebug) console.warn('[fetchTennisLive] fail at', url, e?.message);
    }
  }

  throw lastErr || new Error('No endpoint responded');
}