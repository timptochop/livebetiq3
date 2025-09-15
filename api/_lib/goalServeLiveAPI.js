// api/_lib/goalServeLiveAPI.js
// Ενιαία πρόσβαση στο GoalServe, ανθεκτική σε JSON/XML, gzip.
// Απαιτεί μόνο το env: GOALSERVE_TOKEN (διαβάζω και GOALSERVE_KEY για backup).

import zlib from 'zlib';
import { parseStringPromise } from 'xml2js';

const TOKEN = process.env.GOALSERVE_TOKEN || process.env.GOALSERVE_KEY;

if (!TOKEN) {
  // Μην αφήνεις να εκκινεί χωρίς token
  throw new Error('[GOALSERVE] Missing env var: GOALSERVE_TOKEN');
}

const URL_JSON = `https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${TOKEN}`;
const URL_XML  = `https://www.goalserve.com/getfeed/tennis_scores/home/?key=${TOKEN}`;

function bufferMaybeGunzip(buf, contentEncoding) {
  try {
    if (contentEncoding && contentEncoding.toLowerCase().includes('gzip')) {
      return zlib.gunzipSync(buf);
    }
    return buf;
  } catch (e) {
    // Αν δεν ήταν gzip τελικά, επέστρεψέ το ως έχει
    return buf;
  }
}

async function fetchText(url) {
  // Χρησιμοποιούμε native fetch (Node 18+)
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/xml, text/plain; q=0.9, */*; q=0.8',
      'User-Agent': 'LiveBetIQ/1.0 (+vercel serverless)'
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[GOALSERVE] HTTP ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }

  const enc = res.headers.get('content-encoding') || '';
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  const out = bufferMaybeGunzip(buf, enc);
  return out.toString('utf8');
}

function normalizeFromJson(data) {
  const scores = data?.scores;
  if (!scores) return { matches: [] };

  const cats = Array.isArray(scores.category) ? scores.category : (scores.category ? [scores.category] : []);
  const matches = [];

  for (const cat of cats) {
    const tournament =
      cat?.name || cat?.['@name'] || cat?.$?.name || cat?.category || 'Unknown Tournament';

    const list = Array.isArray(cat.match) ? cat.match : (cat.match ? [cat.match] : []);
    for (const m of list) {
      // JSON εκδοχές παίζουν να έχουν είτε player ως array από strings/objects
      const p = Array.isArray(m.player) ? m.player : (m.players || []);
      const p0 = p?.[0] || {};
      const p1 = p?.[1] || {};
      const home = p0.name || p0._ || p0['@name'] || p0 || '';
      const away = p1.name || p1._ || p1['@name'] || p1 || '';

      matches.push({
        id: m.id || m['@id'] || `${m.date || ''}-${m.time || ''}-${home}-${away}`,
        tournament,
        home,
        away,
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
  // xml2js -> flat attributes
  const json = await parseStringPromise(xml, { explicitArray: false, mergeAttrs: true });
  return json;
}

function normalizeFromXmlJson(json) {
  const scores = json?.scores;
  if (!scores) return { matches: [] };

  const cats = Array.isArray(scores.category) ? scores.category : (scores.category ? [scores.category] : []);
  const matches = [];

  for (const cat of cats) {
    const tournament = cat?.name || cat?.category || 'Unknown Tournament';
    const list = Array.isArray(cat.match) ? cat.match : (cat.match ? [cat.match] : []);

    for (const m of list) {
      const players = Array.isArray(m.player) ? m.player : [];
      const p0 = players?.[0] || {};
      const p1 = players?.[1] || {};
      const home = p0._ || p0.name || p0 || '';
      const away = p1._ || p1.name || p1 || '';

      matches.push({
        id: m.id || `${m.date || ''}-${m.time || ''}-${home}-${away}`,
        tournament,
        home,
        away,
        status: m.status || '',
        time: m.time || '',
        odds: m.odds ?? null,
        raw: m
      });
    }
  }

  return { matches };
}

export async function fetchLiveTennis() {
  // 1) Προσπάθησε JSON
  try {
    const txt = await fetchText(URL_JSON);
    // Αν είναι JSON πραγματικά
    if (txt.trim().startsWith('{') || txt.trim().startsWith('[')) {
      const data = JSON.parse(txt);
      return normalizeFromJson(data);
    }
    // Αν γύρισε XML παρ’ ότι ζητήσαμε json=1, προσπάθησε να το κάνεις parse
    const j = await parseXmlToJson(txt);
    return normalizeFromXmlJson(j);
  } catch (e1) {
    // 2) Fallback: XML URL
    try {
      const xml = await fetchText(URL_XML);
      const j = await parseXmlToJson(xml);
      return normalizeFromXmlJson(j);
    } catch (e2) {
      console.error('[GOALSERVE] Fetch failed:', e1?.message, '| Fallback failed:', e2?.message);
      return { matches: [], error: e2?.message || e1?.message || 'Unknown error' };
    }
  }
}