// api/_lib/goalServeLiveAPI.js
const DEFAULT_TIMEOUT_MS = 8000;
const RETRIES = 2;

const getToken = () => {
  const k = process.env.GOALSERVE_TOKEN || process.env.GOALSERVE_KEY;
  if (!k) throw new Error('Missing GOALSERVE_TOKEN / GOALSERVE_KEY');
  return k.trim();
};

const makeUrls = (token) => ([
  // 1) feed1 με HTTPS
  `https://feed1.goalserve.com/getfeed/${encodeURIComponent(token)}/tennis_scores/home/?json=1`,
  // 2) feed1 με HTTP (μερικά accounts απαντούν μόνο σε http)
  `http://feed1.goalserve.com/getfeed/${encodeURIComponent(token)}/tennis_scores/home/?json=1`,
  // 3) www.goalserve.com με ?key=
  `https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${encodeURIComponent(token)}`
]);

async function once(url, { timeoutMs }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json,text/plain,*/*',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'User-Agent': 'livebetiq3/1.0 (+vercel)'
      },
      signal: ctrl.signal
    });

    const text = await res.text(); // πιο ασφαλές: πρώτα text, μετά JSON.parse

    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} ${res.statusText}`);
      err.status = res.status;
      err.body = text?.slice(0, 300);
      throw err;
    }

    if (text.trim().startsWith('<')) {
      // Κάποιες φορές γυρνάει XML κατά λάθος
      const err = new Error('upstream_returned_xml');
      err.body = text?.slice(0, 300);
      throw err;
    }

    // JSON με BOM/παράξενα κενά -> καθάρισμα
    const cleaned = text.replace(/^\uFEFF/, '');
    return JSON.parse(cleaned);
  } finally {
    clearTimeout(t);
  }
}

function normalize(json) {
  const scores = json?.scores;
  if (!scores) return { matches: [] };

  const cats = Array.isArray(scores.category) ? scores.category : (scores.category ? [scores.category] : []);
  const out = [];

  for (const cat of cats) {
    const tournament = cat?.name || cat?.$?.name || cat?.['@name'] || 'Unknown Tournament';
    const ms = Array.isArray(cat?.match) ? cat.match : (cat?.match ? [cat.match] : []);
    for (const m of ms) {
      const players = Array.isArray(m?.player) ? m.player : (m?.player ? [m.player] : []);
      const p0 = players[0] ?? {};
      const p1 = players[1] ?? {};

      const home = p0?.name ?? p0?._ ?? p0 ?? m?.home ?? '';
      const away = p1?.name ?? p1?._ ?? p1 ?? m?.away ?? '';

      out.push({
        id: m?.id ?? m?.['@id'] ?? `${m?.date || ''}-${m?.time || ''}-${home}-${away}`,
        date: m?.date ?? m?.['@date'] ?? '',
        time: m?.time ?? m?.['@time'] ?? '',
        status: m?.status ?? m?.['@status'] ?? '',
        categoryName: tournament,
        players: players.map((p) => ({
          name: p?.name ?? p?._ ?? p?.['@name'] ?? '',
          s1: p?.s1 ?? p?.['@s1'] ?? null,
          s2: p?.s2 ?? p?.['@s2'] ?? null,
          s3: p?.s3 ?? p?.['@s3'] ?? null,
          s4: p?.s4 ?? p?.['@s4'] ?? null,
          s5: p?.s5 ?? p?.['@s5'] ?? null
        })),
        raw: m
      });
    }
  }

  return { matches: out };
}

/** Κύρια συνάρτηση: retries + rotation */
export async function fetchLiveTennis(debug = false) {
  const token = getToken();
  const urls = makeUrls(token);
  const tried = [];
  let lastErr = null;

  for (let i = 0; i < 1 + RETRIES; i++) {
    const url = urls[i % urls.length];
    tried.push(url);
    try {
      const raw = await once(url, { timeoutMs: DEFAULT_TIMEOUT_MS });
      const out = normalize(raw);
      if (debug) return { ...out, meta: { urlTried: tried, retry: i, provider: 'goalserve-json' } };
      return out;
    } catch (e) {
      lastErr = e;
      // Retry μόνο σε 5xx/timeout/XML
      const retriable =
        e.name === 'AbortError' ||
        e.message === 'upstream_returned_xml' ||
        (e.status >= 500 && e.status < 600);
      if (!retriable) break;
    }
  }

  return {
    matches: [],
    error: lastErr ? String(lastErr.message || lastErr) : 'Unknown upstream error',
    meta: debug ? { urlTried: tried, provider: 'goalserve-json', body: lastErr?.body } : undefined
  };
}