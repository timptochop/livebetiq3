// src/utils/aiEngineV2.js
//
// V2 light-weight engine με ανθεκτικό extraction + logistic score.
// Δεν βασίζεται σε εξωτερικές βιβλιοθήκες και αν δεν υπάρχουν odds/ιστορικά,
// κάνει graceful fallback ώστε ΠΑΝΤΑ να επιστρέφει χρήσιμη εκτίμηση.

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Δέχεται decimal ή moneyline και επιστρέφει DECIMAL odds
function toDecimalOdds(v) {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isFinite(n)) {
    // decimal > 1.0  (2.10, 1.75, κ.λπ.)
    if (n > 1.0) return n;
    // moneyline (±)
    if (Math.abs(n) >= 100) {
      return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
    }
  }
  // string moneyline
  const s = String(v).trim();
  if (/^[+-]?\d+$/.test(s)) {
    const ml = parseInt(s, 10);
    return ml > 0 ? 1 + ml / 100 : 1 + 100 / Math.abs(ml);
  }
  return null;
}

// Προσπάθεια να βρούμε odds σε πολλές πιθανές δομές
function extractDecimalOdds(match) {
  const o = match?.odds ?? match?.liveOdds ?? match?.market ?? null;

  const tryPairs = [
    [o?.p1, o?.p2],
    [o?.player1, o?.player2],
    [o?.home, o?.away],
    [o?.a, o?.b],
    [o?.one, o?.two],
    // nested κοινές περιπτώσεις
    [o?.player1?.decimal, o?.player2?.decimal],
    [o?.player1?.dec, o?.player2?.dec],
    [o?.player1?.ml, o?.player2?.ml],
    [o?.home?.decimal, o?.away?.decimal],
    [o?.home?.ml, o?.away?.ml],
  ];

  for (const [x, y] of tryPairs) {
    const d1 = toDecimalOdds(x);
    const d2 = toDecimalOdds(y);
    if (d1 && d2) return { d1, d2 };
  }
  return { d1: null, d2: null };
}

function impliedProb(decimal) {
  return decimal ? 1 / decimal : null;
}

// ---------- Score features ----------
function readSetScores(players = []) {
  const a = players[0] || {};
  const b = players[1] || {};
  const grab = (p) => [
    toNum(p.s1), toNum(p.s2), toNum(p.s3), toNum(p.s4), toNum(p.s5),
  ];
  const sA = grab(a);
  const sB = grab(b);
  let setNum = 0;
  let gamesA = 0;
  let gamesB = 0;
  for (let i = 0; i < 5; i++) {
    const has = sA[i] != null || sB[i] != null;
    if (has) setNum = i + 1;
    gamesA += sA[i] || 0;
    gamesB += sB[i] || 0;
  }
  const totalGames = gamesA + gamesB || 1;
  const momentum = 0.5 + (gamesA - gamesB) / (2 * totalGames); // [0..1]
  return { setNum, momentum, gamesA, gamesB };
}

// odds drift από πρόσφατο ιστορικό (πιθανότητα φαβορί)
function readDrift(match, favProbNow) {
  const hist =
    match?.oddsHistory ??
    match?.odds?.history ??
    match?.liveOddsHistory ??
    [];

  if (!Array.isArray(hist) || hist.length < 2) return 0;

  // Πάρε 2 τελευταία σημεία ως decimal για favorite και κάνε diff στο implied prob
  const last = hist[hist.length - 1];
  const prev = hist[hist.length - 2];

  const dLast = toDecimalOdds(last?.fav ?? last?.p1 ?? last);
  const dPrev = toDecimalOdds(prev?.fav ?? prev?.p1 ?? prev);

  if (!dLast || !dPrev) return 0;

  const pLast = impliedProb(dLast);
  const pPrev = impliedProb(dPrev);
  const drift = (pLast - pPrev); // >0 βελτιώνεται (κοκκινίζει το underdog)
  // Αν δεν έχουμε favProbNow, επέστρεψε κανονικοποιημένο drift
  if (!favProbNow) return Math.max(-0.2, Math.min(0.2, drift));
  // Διατήρησε μικρό εύρος
  return Math.max(-0.2, Math.min(0.2, drift));
}

// Εξαγωγή χαρακτηριστικών (0..1)
export function extractFeatures(match = {}) {
  const status = String(match.status || match['@status'] || '').toLowerCase();
  const live = !!status && status !== 'not started';

  const players =
    Array.isArray(match.players) ? match.players :
    Array.isArray(match.player) ? match.player : [];

  const { setNum, momentum } = readSetScores(players);

  const { d1, d2 } = extractDecimalOdds(match);
  const p1 = impliedProb(d1);
  const p2 = impliedProb(d2);
  // πιθανότητα φαβορί
  const pFav = p1 && p2 ? Math.max(p1, p2) : 0.5;

  const drift = readDrift(match, pFav); // ~[-0.2..0.2]

  // Κανονικοποιήσεις
  const f = {
    // odds-based confidence του φαβορί
    pOdds: pFav, // 0.5 baseline αν άγνωστο
    // από διαφορά games
    momentum: Math.max(0, Math.min(1, momentum)), // [0..1]
    // προς τα κάτω/πάνω, map σε [0..1]
    drift: 0.5 + drift, // [-0.2..0.2] -> [0.3..0.7], 0.5 neutral
    setNum: Math.max(0, Math.min(5, setNum)) / 5, // [0..1]
    live,
  };

  return f;
}

// Βάρη – «νοητή» καλιμπράριση v2 (ασφαλή defaults)
const W = {
  pOdds: 0.90,
  momentum: 0.55,
  drift: 0.35,
  setNum: 0.10,
  live: 0.15,
};
const BIAS = -0.55;

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

export function score(features) {
  const z =
    W.pOdds * features.pOdds +
    W.momentum * features.momentum +
    W.drift * features.drift +
    W.setNum * features.setNum +
    W.live * (features.live ? 1 : 0) +
    BIAS;
  return sigmoid(z); // 0..1
}

export function toLabel(conf, features) {
  // Αν δεν είναι live → SOON/SET
  if (!features.live) {
    return { label: 'SOON', kellyLevel: 'LOW' };
  }

  // Κατώφλια v2 (safe defaults)
  if (conf >= 0.86) return { label: 'SAFE', kellyLevel: 'HIGH' };
  if (conf >= 0.73) return { label: 'RISKY', kellyLevel: 'MED' };

  // Αν πολύ νωρίς (χαμηλό setNum), δείξε ουδέτερο σήμα
  if (features.setNum <= 0.2) return { label: 'SET 1', kellyLevel: 'LOW' };

  return { label: 'AVOID', kellyLevel: 'LOW' };
}