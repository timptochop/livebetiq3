// api/_lib/goalServeLiveAPI.js
import axios from 'axios';

const TOKEN = process.env.GOALSERVE_KEY || process.env.GOALSERVE_TOKEN || '';
const BASES = [
  // JSON feed (προτιμάται)
  (t) => `https://www.goalserve.com/getfeed/tennis_scores/home/?json=1&key=${t}`,
  // Fallback (μερικές φορές δουλεύει όταν το json=1 500-άρει)
  (t) => `https://www.goalserve.com/getfeed/tennis_scores/home/?key=${t}&json=1`,
];

// Μικρό helper για αναμονή ανάμεσα σε retries
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function fetchLiveTennisRaw(debug = false) {
  if (!TOKEN) {
    return { matches: [], error: 'Missing GOALSERVE_TOKEN/GOALSERVE_KEY', meta: {} };
  }

  const tried = [];
  const headers = {
    // Μερικά CDNs θέλουν UA
    'User-Agent': 'LiveBetIQ/1.0 (+vercel-serverless)',
    'Accept': 'application/json,text/plain,*/*',
    // Αφήνουμε το axios να χειριστεί gzip
  };

  // 2 προσπάθειες × 2 URLs = 4 το πολύ χτυπήματα
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const buildUrl of BASES) {
      const url = buildUrl(TOKEN) + `&nocache=${Date.now()}`; // cache-bust
      tried.push(url);

      try {
        const resp = await axios.get(url, {
          headers,
          timeout: 7000,
          // Επιτρέπουμε redirect/encoding by default
        });

        // Περιμένουμε JSON structure: { scores: { category: [...] } } ή { matches: [...] }
        const data = resp.data;

        // Αν ο provider επιστρέψει "σκέτο" object με scores
        if (data && data.scores) {
          return { data, tried };
        }

        // Αν επιστρέψει ήδη κανονικοποιημένη λίστα (σπάνιο)
        if (data && Array.isArray(data.matches)) {
          return { data: { scores: { category: [] }, matches: data.matches }, tried };
        }

        // Αν φτάσουμε εδώ, είναι άγνωστη δομή — το περνάμε στον normalizer να προσπαθήσει
        return { data, tried };
      } catch (err) {
        // Αν ο upstream δώσει 500/502/503 κτλ συνεχίζουμε στα επόμενα URL/attempt
        if (debug) console.error('[GS FETCH ERR]', err?.response?.status, err?.message);
        // μικρή καθυστέρηση πριν την επόμενη προσπάθεια
        await sleep(400);
      }
    }
  }

  return {
    error: 'HTTP 500 Internal Server Error',
    tried,
  };
}

function num(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(n) ? n : null;
}

// Μετατροπή από το json του GoalServe σε flat matches[]
export function normalizeGoalServe(data) {
  // data μπορεί να είναι { scores: {...} } ή κάτι άλλο – το χειριζόμαστε προσεκτικά
  const scores = data?.scores;
  const categories = scores?.category ?? [];
  const catArr = Array.isArray(categories) ? categories : [categories];

  const matches = [];

  for (const cat of catArr) {
    if (!cat) continue;
    const tournament = cat?.name || cat?.$?.name || 'Unknown Tournament';
    const matchList = cat?.match ?? [];
    const mArr = Array.isArray(matchList) ? matchList : [matchList];

    for (const m of mArr) {
      if (!m) continue;

      // Players μπορούν να είναι είτε array από objects είτε απλές τιμές
      const players = m.player ?? [];
      const pArr = Array.isArray(players) ? players : [players];
      const getName = (p) => (p?.name ?? p?._ ?? p ?? '').toString();

      const home = getName(pArr[0] ?? {});
      const away = getName(pArr[1] ?? {});

      // Sets αν υπάρχουν σε s1..s5
      const s1 = num(m.s1), s2 = num(m.s2), s3 = num(m.s3), s4 = num(m.s4), s5 = num(m.s5);

      matches.push({
        id: m.id ?? m.matchid ?? `${tournament}-${home}-${away}-${m.time ?? ''}`,
        tournament,
        home,
        away,
        status: m.status ?? '',
        time: m.time ?? '',
        date: m.date ?? '',
        sets: [s1, s2, s3, s4, s5].filter((x) => x !== null),
        raw: m,
      });
    }
  }

  return matches;
}

export async function fetchLiveTennis(debug = false) {
  const res = await fetchLiveTennisRaw(debug);

  if (res.error) {
    return {
      matches: [],
      error: res.error,
      meta: { urlTried: res.tried ?? [] },
    };
  }

  try {
    const matches = normalizeGoalServe(res.data);
    return { matches, meta: { ok: true } };
  } catch (e) {
    return {
      matches: [],
      error: 'ParseError',
      meta: { detail: e?.message, sample: typeof res.data },
    };
  }
}