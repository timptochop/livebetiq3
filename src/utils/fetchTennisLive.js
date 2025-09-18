// src/utils/fetchTennisLive.js
// Προσπαθεί πρώτα predictions (με AI), αλλιώς κάνει fallback σε live.

const isDebug = (() => {
  try { return new URLSearchParams(window.location.search).get('debug') === '1'; }
  catch { return false; }
})();

async function getJSON(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    throw new Error(`HTTP ${r.status} @ ${url} :: ${t.slice(0,160)}`);
  }
  try {
    return await r.json();
  } catch {
    const t = await r.text().catch(() => '');
    if (isDebug) console.warn('[fetchTennisLive] non-JSON:', t?.slice(0,200));
    try { return JSON.parse(t); } catch { throw new Error('Response is not valid JSON'); }
  }
}

export default async function fetchTennisLive() {
  const CANDIDATES = [
    '/api/gs/tennis-predictions', // έχει prediction.label
    '/api/gs/tennis-live',        // fallback χωρίς AI (ή PENDING)
  ];

  for (const url of CANDIDATES) {
    try {
      if (isDebug) console.log('[fetchTennisLive] try', url);
      const data = await getJSON(url);
      const arr = Array.isArray(data?.matches) ? data.matches
                : Array.isArray(data)          ? data
                : [];
      if (isDebug) console.log('[fetchTennisLive] ok', url, 'count=', arr.length);
      return arr;
    } catch (e) {
      if (isDebug) console.warn('[fetchTennisLive] fail', url, e?.message);
      // try next
    }
  }
  if (isDebug) console.warn('[fetchTennisLive] no endpoints responded, returning []');
  return [];
}