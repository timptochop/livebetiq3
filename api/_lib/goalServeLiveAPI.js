// api/_lib/goalServeLiveAPI.js
import axios from 'axios';
import zlib from 'zlib';
import { parseStringPromise } from 'xml2js';

// Βάλε κανονικά το κλειδί σου στα Vercel ENV (GOALSERVE_KEY)
const KEY  = process.env.GOALSERVE_KEY || 'f31155052f6749178f8808dde8bc3095';
const BASE = `https://www.goalserve.com/getfeed/${KEY}/tennis_scores`;
const URL_JSON = `${BASE}/home?json=1`; // JSON endpoint
const URL_XML  = `${BASE}/home`;        // XML (συχνά gzip)

const UA_HEADERS = {
  'User-Agent': 'LiveBetIQ/1.0 (Vercel Serverless)',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Encoding': 'gzip,deflate,br',
  'Connection': 'keep-alive',
};

const isGzip = (buf) => buf?.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
const toArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

function extractMatches(root) {
  const categories = root?.scores?.category ?? [];
  const cats = toArray(categories);

  const out = [];
  for (const cat of cats) {
    const tournament =
      cat?.name || cat?.$?.name || cat?.['@name'] || cat?._attr?.name || 'Unknown Tournament';

    const matchList = toArray(cat?.match);
    for (const m of matchList) {
      const players = toArray(m?.player ?? m?.players);
      const p1 = players[0] ?? {};
      const p2 = players[1] ?? {};
      const text = (o) =>
        typeof o === 'string'
          ? o
          : o?.name ?? o?._ ?? o?._text ?? o?.['@name'] ?? '';

      out.push({
        id: m?.id ?? m?.match_id ?? m?.['@id'] ?? m?._attr?.id ?? '',
        tournament,
        home: String(text(p1) || ''),
        away: String(text(p2) || ''),
        status: m?.status ?? m?.['@status'] ?? m?._attr?.status ?? '',
        time: m?.time ?? m?.['@time'] ?? m?._attr?.time ?? '',
        date: m?.date ?? m?.['@date'] ?? m?._attr?.date ?? '',
        odds: m?.odds ?? null,
        raw: m,
      });
    }
  }
  return out;
}

/**
 * ΠΑΝΤΑ επιστρέφει Array. Δεν πετάμε exception προς τον handler.
 * 1) JSON (responseType=json, χωρίς throw σε 4xx/5xx)
 * 2) XML fallback (arraybuffer, αν είναι gzip το ανοίγουμε)
 */
export async function fetchLiveTennis() {
  // --- JSON first ---
  try {
    const res = await axios.get(URL_JSON, {
      timeout: 10000,
      headers: UA_HEADERS,
      responseType: 'json',
      validateStatus: () => true, // δεν κάνει throw σε 4xx/5xx
    });
    if (res.status >= 200 && res.status < 300 && res.data && typeof res.data === 'object') {
      return extractMatches(res.data);
    }
    console.warn('[GS] JSON endpoint returned', res.status);
  } catch (e) {
    console.warn('[GS] JSON fetch error:', e?.message);
  }

  // --- XML fallback ---
  try {
    const res = await axios.get(URL_XML, {
      timeout: 10000,
      headers: UA_HEADERS,
      responseType: 'arraybuffer',
      decompress: false,
      validateStatus: () => true,
    });
    if (!(res.status >= 200 && res.status < 300)) {
      console.warn('[GS] XML endpoint returned', res.status);
      return [];
    }

    let buf = Buffer.from(res.data);
    if (isGzip(buf)) {
      try { buf = zlib.gunzipSync(buf); }
      catch (e) { console.warn('[GS] gunzip failed, treating as plain XML:', e?.message); }
    }

    const xml = buf.toString('utf8');
    const obj = await parseStringPromise(xml, {
      explicitArray: false,
      attrkey: '@',
      charkey: '_',
      mergeAttrs: true,
    });
    return extractMatches(obj);
  } catch (e) {
    console.error('[GS] XML fetch error:', e?.message);
  }

  return [];
}