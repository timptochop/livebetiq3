// api/_lib/goalServeLiveAPI.js
// Ενιαίο fetch από GoalServe (JSON ή XML, με/χωρίς gzip) + διαγνωστικά meta.

import zlib from 'zlib';
import { parseStringPromise } from 'xml2js';

const TOKEN = process.env.GOALSERVE_TOKEN || process.env.GOALSERVE_KEY;
if (!TOKEN) throw new Error('[GOALSERVE] Missing env var: GOALSERVE_TOKEN');

const URL_JSON = `https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${TOKEN}`;
const URL_XML  = `https://www.goalserve.com/getfeed/tennis_scores/home/?key=${TOKEN}`;

function sanitizeUrl(u) {
  try {
    const url = new URL(u);
    if (url.searchParams.has('key')) url.searchParams.set('key', '***');
    return url.toString();
  } catch {
    return u;
  }
}

function maybeGunzip(buf, encoding) {
  try {
    if (encoding && encoding.toLowerCase().includes('gzip')) {
      return zlib.gunzipSync(buf);
    }
    return buf;
  } catch {
    return buf;
  }
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/xml, text/plain; q=0.9, */*; q=0.8',
      'User-Agent': 'LiveBetIQ/1.0 (+vercel)'
    }
  });
  const enc = res.headers.get('content-encoding') || '';
  const ct  = res.headers.get('content-type') || '';
  const ab  = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  const txt = maybeGunzip(buf, enc).toString('utf8');

  return { ok: res.ok, status: res.status, statusText: res.statusText, ct, enc, bytes: buf.length, txt };
}

function normalizeFromJson(data) {
  const scores = data?.scores;
  const cats = Array.isArray(scores?.category) ? scores.category : (scores?.category ? [scores.category] : []);
  const matches = [];

  for (const cat of cats) {
    const tournament = cat?.name || cat?.['@name'] || cat?.$?.name || cat?.category || 'Unknown Tournament';
    const list = Array.isArray(cat.match) ? cat.match : (cat.match ? [cat.match] : []);
    for (const m of list) {
      const arr = Array.isArray(m.player) ? m.player : (m.players || []);
      const p0 = arr?.[0] || {}; const p1 = arr?.[1] || {};
      const home = p0.name || p0._ || p0['@name'] || p0 || '';
      const away = p1.name || p1._ || p1['@name'] || p1 || '';
      matches.push({
        id: m.id || m['@id'] || `${m.date || ''}-${m.time || ''}-${home}-${away}`,
        tournament,
        home, away,
        status: m.status || m['@status'] || '',
        time: m.time || m['@time'] || '',
        odds: m.odds ?? null,
        raw: m
      });
    }
  }
  return { matches };
}

async function parseXmlToJson(xml) {
  return parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });
}

function normalizeFromXmlJson(json) {
  const scores = json?.scores;
  const cats = Array.isArray(scores?.category) ? scores.category : (scores?.category ? [scores.category] : []);
  const matches = [];

  for (const cat of cats) {
    const tournament = cat?.name || cat?.category || 'Unknown Tournament';
    const list = Array.isArray(cat.match) ? cat.match : (cat.match ? [cat.match] : []);
    for (const m of list) {
      const arr = Array.isArray(m.player) ? m.player : [];
      const p0 = arr?.[0] || {}; const p1 = arr?.[1] || {};
      const home = p0._ || p0.name || p0 || '';
      const away = p1._ || p1.name || p1 || '';
      matches.push({
        id: m.id || `${m.date || ''}-${m.time || ''}-${home}-${away}`,
        tournament,
        home, away,
        status: m.status || '',
        time: m.time || '',
        odds: m.odds ?? null,
        raw: m
      });
    }
  }
  return { matches };
}

export async function fetchLiveTennis({ debug = false } = {}) {
  // 1) δοκίμασε JSON endpoint
  try {
    const r1 = await fetchText(URL_JSON);
    if (!r1.ok) throw new Error(`HTTP ${r1.status} ${r1.statusText}`);

    let mode = 'json-text';
    if (r1.txt.trim().startsWith('{') || r1.txt.trim().startsWith('[')) {
      const data = JSON.parse(r1.txt);
      const out = normalizeFromJson(data);
      return {
        ...out,
        meta: debug ? { url: sanitizeUrl(URL_JSON), mode, ct: r1.ct, enc: r1.enc, bytes: r1.bytes } : undefined
      };
    } else {
      // επέστρεψε XML παρ' ότι ζητήσαμε json=1
      mode = 'xml-from-json-url';
      const j = await parseXmlToJson(r1.txt);
      const out = normalizeFromXmlJson(j);
      return {
        ...out,
        meta: debug ? { url: sanitizeUrl(URL_JSON), mode, ct: r1.ct, enc: r1.enc, bytes: r1.bytes } : undefined
      };
    }
  } catch (e1) {
    // 2) fallback XML endpoint
    try {
      const r2 = await fetchText(URL_XML);
      if (!r2.ok) throw new Error(`HTTP ${r2.status} ${r2.statusText}`);
      const j = await parseXmlToJson(r2.txt);
      const out = normalizeFromXmlJson(j);
      return {
        ...out,
        meta: debug ? { url: sanitizeUrl(URL_XML), mode: 'xml', ct: r2.ct, enc: r2.enc, bytes: r2.bytes } : undefined
      };
    } catch (e2) {
      return {
        matches: [],
        error: e2?.message || e1?.message || 'Unknown error',
        meta: debug ? { urlTried: [sanitizeUrl(URL_JSON), sanitizeUrl(URL_XML)] } : undefined
      };
    }
  }
}