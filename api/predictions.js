// api/predictions.js
// Vercel Serverless Function – returns tennis predictions from LIVE provider,
// with a safe fallback to mock data if env vars are missing or the provider fails.

export const config = {
  runtime: 'nodejs18.x', // ensure modern fetch (Node 18) on Vercel
};

const LIVE_API_URL = process.env.LIVE_API_URL || '';   // e.g. https://api.example.com/tennis/live
const LIVE_API_KEY = process.env.LIVE_API_KEY || '';   // e.g. your token/key

/** ---- Utility: safe number ---- */
function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

/** ---- Heuristic: derive current set from a generic score object/strings ---- */
function deriveCurrentSetFromScore(score) {
  // try common shapes:
  // - "2-1"  -> 3
  // - { sets: {p1:2, p2:1} } -> 3
  if (!score) return 0;

  if (typeof score === 'string') {
    const m = score.match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if (m) return num(m[1]) + num(m[2]);
  }
  if (typeof score === 'object' && score.sets) {
    const s = score.sets;
    return num(s.p1) + num(s.p2);
  }
  return 0;
}

/** ---- Map provider match -> app match shape ---- */
function mapProviderMatch(raw) {
  // Προσπάθησε να διαβάσεις παίκτες, αποδόσεις, ώρα/σετ από διάφορα πιθανά πεδία.
  const p1 = raw.player1 ?? raw.home ?? raw.p1 ?? raw.name1 ?? 'Player A';
  const p2 = raw.player2 ?? raw.away ?? raw.p2 ?? raw.name2 ?? 'Player B';

  // odds: δεχόμαστε decimal όπως 1.65 / 2.25
  const odds1 =
    num(raw.odds1) ||
    num(raw.homeOdds) ||
    num(raw.decimalOdds1) ||
    num(raw.odds?.p1) ||
    0;

  const odds2 =
    num(raw.odds2) ||
    num(raw.awayOdds) ||
    num(raw.decimalOdds2) ||
    num(raw.odds?.p2) ||
    0;

  // time / status – χρησιμοποιείται από το UI για STARTS SOON / PENDING
  const status =
    raw.status ?? raw.time ?? raw.phase ?? raw.state ?? 'Live';

  // score/sets – βοηθά το UI να δείξει PENDING μέχρι set 3
  const currentSet =
    num(raw.currentSet) ||
    deriveCurrentSetFromScore(raw.score ?? raw.sets ?? raw.result ?? null);

  return {
    id: String(raw.id ?? `${p1}-${p2}-${raw.startTime ?? ''}`),
    player1: String(p1),
    player2: String(p2),
    odds1: odds1,
    odds2: odds2,
    time: String(status),
    currentSet, // το UI θα προτιμήσει αυτό όταν υπάρχει
  };
}

/** ---- Fallback mock (μόνο αν λείπουν envs ή σκάσει ο provider) ---- */
function mockList() {
  return [
    {
      id: 'm1',
      player1: 'Djokovic',
      player2: 'Nadal',
      odds1: 1.70,
      odds2: 2.20,
      time: 'Live',
      currentSet: 2,
    },
    {
      id: 'm2',
      player1: 'Alcaraz',
      player2: 'Zverev',
      odds1: 1.95,
      odds2: 1.95,
      time: 'Starts Soon',
      currentSet: 0,
    },
    {
      id: 'm3',
      player1: 'Tsitsipas',
      player2: 'Medvedev',
      odds1: 2.40,
      odds2: 1.55,
      time: 'Live',
      currentSet: 2,
    },
  ];
}

/** ---- Main handler ---- */
export default async function handler(req, res) {
  // Vercel προθερμαίνει με preflight / cache – επιτρέπουμε GET μόνο
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Αν δεν έχουν μπει env vars → γύρνα mock,
  // ώστε το site να μένει online και να βλέπεις UI.
  if (!LIVE_API_URL || !LIVE_API_KEY) {
    return res.status(200).json(mockList());
  }

  try {
    // Κάλεσε τον live provider. Προσαρμόζεις headers/query όπως χρειάζεται.
    const url = new URL(LIVE_API_URL);
    // π.χ. url.searchParams.set('sport', 'tennis');

    const rsp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${LIVE_API_KEY}`, // ή 'x-api-key': LIVE_API_KEY
        'Accept': 'application/json',
      },
      // cache: 'no-store' // αν δεν θέλεις caching
    });

    if (!rsp.ok) {
      // provider error -> γύρνα mock για να μην πέσει το UI
      console.warn('[api/predictions] Provider HTTP', rsp.status);
      return res.status(200).json(mockList());
    }

    const data = await rsp.json().catch(() => null);

    // Προσάρμοσε το parsing ανάλογα με τον provider:
    // π.χ. data.matches || data.events || data
    const matches = Array.isArray(data?.matches)
      ? data.matches
      : Array.isArray(data?.events)
      ? data.events
      : Array.isArray(data)
      ? data
      : [];

    const mapped = matches.map(mapProviderMatch);

    // Αν για οποιονδήποτε λόγο δεν βγήκαν ματς, πέφτουμε σε mock.
    if (!mapped.length) {
      return res.status(200).json(mockList());
    }

    return res.status(200).json(mapped);
  } catch (err) {
    console.error('[api/predictions] error', err);
    // Σε σφάλμα δικτύου/JSON → mock
    return res.status(200).json(mockList());
  }
}