// api/predictions.js
// Vercel Serverless Function – returns tennis predictions from LIVE provider,
// with a safe fallback to mock data if env vars are missing or the provider fails.

export const config = {
  runtime: 'nodejs', // ✅ valid value for Vercel (Node 18+ by default)
};

const LIVE_API_URL = process.env.LIVE_API_URL || '';   // e.g. https://api.example.com/tennis/live
const LIVE_API_KEY = process.env.LIVE_API_KEY || '';   // e.g. your token/key

// ---- utils ----
function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function deriveCurrentSetFromScore(score) {
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

function mapProviderMatch(raw) {
  const p1 = raw.player1 ?? raw.home ?? raw.p1 ?? raw.name1 ?? 'Player A';
  const p2 = raw.player2 ?? raw.away ?? raw.p2 ?? raw.name2 ?? 'Player B';

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

  const status =
    raw.status ?? raw.time ?? raw.phase ?? raw.state ?? 'Live';

  const currentSet =
    num(raw.currentSet) ||
    deriveCurrentSetFromScore(raw.score ?? raw.sets ?? raw.result ?? null);

  return {
    id: String(raw.id ?? `${p1}-${p2}-${raw.startTime ?? ''}`),
    player1: String(p1),
    player2: String(p2),
    odds1,
    odds2,
    time: String(status),
    currentSet,
  };
}

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!LIVE_API_URL || !LIVE_API_KEY) {
    return res.status(200).json(mockList());
  }

  try {
    const url = new URL(LIVE_API_URL);
    const rsp = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${LIVE_API_KEY}`,
        Accept: 'application/json',
      },
    });

    if (!rsp.ok) {
      console.warn('[api/predictions] Provider HTTP', rsp.status);
      return res.status(200).json(mockList());
    }

    const data = await rsp.json().catch(() => null);

    const matches = Array.isArray(data?.matches)
      ? data.matches
      : Array.isArray(data?.events)
      ? data.events
      : Array.isArray(data)
      ? data
      : [];

    const mapped = matches.map(mapProviderMatch);
    if (!mapped.length) return res.status(200).json(mockList());

    return res.status(200).json(mapped);
  } catch (err) {
    console.error('[api/predictions] error', err);
    return res.status(200).json(mockList());
  }
}