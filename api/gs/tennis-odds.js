// api/gs/tennis-odds.js
// LiveBet IQ – GoalServe tennis odds raw fetch (step 1)

import zlib from 'zlib';
import { promisify } from 'util';
import { parseStringPromise } from 'xml2js';

const gunzip = promisify(zlib.gunzip);

// Προσπαθούμε να χρησιμοποιήσουμε το ίδιο key setup με το tennis-live
const GOALSERVE_KEY =
  process.env.GOALSERVE_KEY || process.env.GOALSERVE_TENNIS_KEY || '';

const ODDS_URL = GOALSERVE_KEY
  ? `https://www.goalserve.com/getfeed/${GOALSERVE_KEY}/getodds/soccer?cat=tennis_10&json=1`
  : null;

async function fetchGoalServeOdds() {
  if (!ODDS_URL) {
    throw new Error('Missing GOALSERVE_KEY / GOALSERVE_TENNIS_KEY env');
  }

  const res = await fetch(ODDS_URL, {
    method: 'GET',
    headers: {
      // ζητάμε κανονικά gzip, ο Node 18 συνήθως το λύνει,
      // αλλά έχουμε και manual gunzip fallback
      'accept-encoding': 'gzip, deflate, br',
    },
  });

  if (!res.ok) {
    throw new Error(`GoalServe odds HTTP ${res.status}`);
  }

  const encoding = res.headers.get('content-encoding') || '';
  const arrayBuf = await res.arrayBuffer();
  const compressed = Buffer.from(arrayBuf);

  let decodedBuf = compressed;
  if (/gzip/i.test(encoding)) {
    decodedBuf = await gunzip(compressed);
  }

  const text = decodedBuf.toString('utf8').trim();

  let parsed;
  try {
    // αν το endpoint γυρίζει JSON (με json=1)
    parsed = JSON.parse(text);
  } catch {
    // αλλιώς το αντιμετωπίζουμε σαν XML
    parsed = await parseStringPromise(text, {
      explicitArray: false,
      mergeAttrs: true,
      trim: true,
    });
  }

  return {
    raw: parsed,
    meta: {
      encoding,
      bytes: compressed.length,
      url: ODDS_URL,
    },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  if (!GOALSERVE_KEY) {
    return res.status(500).json({
      ok: false,
      error: 'Missing GOALSERVE_KEY / GOALSERVE_TENNIS_KEY in environment',
    });
  }

  try {
    const data = await fetchGoalServeOdds();
    return res.status(200).json({
      ok: true,
      ...data, // { raw, meta }
    });
  } catch (err) {
    console.error('[LBQ] tennis-odds route error', err);
    return res.status(500).json({
      ok: false,
      error: String(err && err.message ? err.message : err),
    });
  }
}