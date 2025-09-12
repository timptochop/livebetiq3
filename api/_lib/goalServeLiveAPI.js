// api/_lib/goalServeLiveAPI.js
import axios from 'axios';
import zlib from 'zlib';
import { parseStringPromise } from 'xml2js';

// Βάλε το κλειδί σου στα Vercel Environment Variables (GOALSERVE_KEY)
const KEY = process.env.GOALSERVE_KEY || 'f31155052f6749178f8808dde8bc3095';

// ΣΩΣΤΗ ΒΑΣΗ URL (με key μέσα στη διαδρομή)
const BASE = `https://www.goalserve.com/getfeed/${KEY}/tennis_scores`;
const URL_JSON = `${BASE}/home?json=1`; // JSON σύμφωνα με τα docs   [oai_citation:1‡feeds_urls 2.txt](file-service://file-CqYRBhHWXzNcH17fKRBNyf)
const URL_XML  = `${BASE}/home`;       // XML (συχνά gzip)           [oai_citation:2‡feeds_urls 2.txt](file-service://file-CqYRBhHWXzNcH17fKRBNyf)

const toArray = (x) => (Array.isArray(x) ? x : x ? [x] : []);

// Διαβάζει ομοιόμορφα JSON ή XML-σε-JSON
function extractMatches(root) {
  // Σε JSON: root.scores.category; Σε XML->JSON: το ίδιο σχήμα
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
 * Επιστρέφει ΠΑΝΤΑ array από matches (ποτέ δεν πετάει exception).
 * 1) Προσπαθεί JSON endpoint
 * 2) Fallback: XML (αν είναι gzip το αποσυμπιέζει) -> xml2js -> extract
 */
export async function fetchLiveTennis() {
  // 1) JSON πρώτα
  try {
    const res = await axios.get(URL_JSON, {
      timeout: 8000,
      headers: { Accept: 'application/json' },
      // αφήνουμε axios να αποσυμπιέσει αυτόματα αν είναι gzip
    });

    const payload = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    const matches = extractMatches(payload);
    return matches;
  } catch (e) {
    console.warn('[GS] JSON fetch failed, will try XML fallback:', e?.message);
  }

  // 2) XML fallback (πιθανώς gzip)
  try {
    const res = await axios.get(URL_XML, {
      timeout: 8000,
      responseType: 'arraybuffer',
      // axios δεν κάνει decompress όταν ζητάμε arraybuffer
    });

    const enc = String(res.headers['content-encoding'] || '').toLowerCase();
    let buf = Buffer.from(res.data);

    if (enc.includes('gzip')) {
      try {
        buf = zlib.gunzipSync(buf);
      } catch (gzErr) {
        // Μερικές φορές επιστρέφει ήδη uncompressed
        console.warn('[GS] gunzip failed, treating as plain XML:', gzErr?.message);
      }
    }

    const xml = buf.toString('utf8');
    const xmlObj = await parseStringPromise(xml, {
      explicitArray: false,
      attrkey: '@',
      charkey: '_',
      mergeAttrs: true,
    });

    const matches = extractMatches(xmlObj);
    return matches;
  } catch (e) {
    console.error('[GS] XML fallback failed:', e?.message);
    if (e?.response) {
      console.error('[GS] Response status:', e.response.status, e.response.statusText);
    }
    return [];
  }
}