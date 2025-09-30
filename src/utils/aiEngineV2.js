// src/utils/aiEngineV2.js
// Robust v2 engine: feature extraction + logistic score with safe fallbacks.

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Accepts decimal or moneyline; returns DECIMAL odds
function toDecimalOdds(v) {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isFinite(n)) {
    if (n > 1.0) return n;                 // decimal (e.g. 1.75)
    if (Math.abs(n) >= 100) {              // moneyline (e.g. -120 / +150)
      return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
    }
  }
  const s = String(v).trim();
  if (/^[+-]?\d+$/.test(s)) {
    const ml = parseInt(s, 10);
    return ml > 0 ? 1 + ml / 100 : 1 + 100 / Math.abs(ml);
  }
  return null;
}

// Try to find odds in common shapes
function extractDecimalOdds(match) {
  const o = match?.odds ?? match?.liveOdds ?? match?.market ?? null;
  const tryPairs = [
    [o?.p1, o?.p2],
    [o?.player1, o?.player2],
    [o?.home, o?.away],
    [o?.a, o?.b],
    [o?.one, o?.two],
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

function readSetScores(players = []) {
  const a = players[0] || {};
  const b = players[1] || {};
  const grab = (p) => [toNum(p.s1), toNum(p.s2), toNum(p.s3), toNum(p.s4), toNum(p.s5)];
  const sA = grab(a);
  const sB = grab(b);
  let setNum = 0, gamesA = 0, gamesB = 0;
  for (let i = 0; i < 5; i++) {
    const has = sA[i] != null || sB[i] != null;
    if (has) setNum = i + 1;
    gamesA += sA[i] || 0;
    gamesB += sB[i] || 0;
  }
  const totalGames = gamesA + gamesB || 1;
  const momentum = 0.5 + (gamesA - gamesB) / (2 * totalGames); // [0..1]
  return { setNum, momentum };
}

function readDrift(match, favProbNow) {
  const hist = match?.oddsHistory ?? match?.odds?.history ?? match?.liveOddsHistory ?? [];
  if (!Array.isArray(hist) || hist.length < 2) return 0;
  const last = hist[hist.length - 1];
  const prev = hist[hist.length - 2];
  const dLast = toDecimalOdds(last?.fav ?? last?.p1 ?? last);
  const dPrev = toDecimalOdds(prev?.fav ?? prev?.p1 ?? prev);
  if (!dLast || !dPrev) return 0;
  const pLast = impliedProb(dLast);
  const pPrev = impliedProb(dPrev);
  const drift = pLast - pPrev;
  return Math.max(-0.2, Math.min(0.2, drift)); // clamp
}

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
  const pFav = p1 && p2 ? Math.max(p1, p2) : 0.5;

  const drift = readDrift(match, pFav); // [-0.2..0.2]

  return {
    pOdds: pFav,                                   // 0.5 if unknown
    momentum: Math.max(0, Math.min(1, momentum)),  // [0..1]
    drift: 0.5 + drift,                            // [-0.2..0.2] -> [0.3..0.7]
    setNum: Math.max(0, Math.min(5, setNum)) / 5,  // [0..1]
    live,
  };
}

const W = { pOdds: 0.90, momentum: 0.55, drift: 0.35, setNum: 0.10, live: 0.15 };
const BIAS = -0.55;
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export function score(f) {
  const z =
    W.pOdds * f.pOdds +
    W.momentum * f.momentum +
    W.drift * f.drift +
    W.setNum * f.setNum +
    W.live * (f.live ? 1 : 0) +
    BIAS;
  return sigmoid(z);
}

export function toLabel(conf, f) {
  if (!f.live) return { label: 'SOON', kellyLevel: 'LOW' };
  if (conf >= 0.86) return { label: 'SAFE', kellyLevel: 'HIGH' };
  if (conf >= 0.73) return { label: 'RISKY', kellyLevel: 'MED' };
  if (f.setNum <= 0.2) return { label: 'SET 1', kellyLevel: 'LOW' };
  return { label: 'AVOID', kellyLevel: 'LOW' };
}