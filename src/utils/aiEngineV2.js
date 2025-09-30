// src/utils/aiEngineV2.js
// v2.1: context-aware scoring (tour level & surface) + set-phase momentum scaling.

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Accepts decimal or moneyline; returns DECIMAL odds
function toDecimalOdds(v) {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isFinite(n)) {
    if (n > 1.0) return n;                 // decimal (e.g., 1.75)
    if (Math.abs(n) >= 100) {              // moneyline (e.g., -120 / +150)
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

function readDrift(match) {
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

// Heuristic context from strings: tour level & surface
export function extractContext(match = {}) {
  const raw =
    (match.categoryName ?? match.category ?? match['@category'] ??
     match.tournamentName ?? match.tournament ?? match.league ?? '') + '';
  const s = raw.toLowerCase();

  let level = 'DEFAULT';
  if (/grand\s*sla?m|wimbledon|roland|us\s*open|australian/.test(s)) level = 'SLAM';
  else if (/\bwta\b/.test(s)) level = 'WTA';
  else if (/\batp\b/.test(s)) level = 'ATP';
  else if (/challenger/.test(s)) level = 'CHALLENGER';
  else if (/\bitf\b/.test(s)) level = 'ITF';

  let surface = 'unknown';
  if (/hard/.test(s)) surface = 'hard';
  else if (/clay|roland/.test(s)) surface = 'clay';
  else if (/grass|wimbledon/.test(s)) surface = 'grass';
  else if (/indoor/.test(s)) surface = 'indoor';
  else if (/carpet/.test(s)) surface = 'carpet';

  return { level, surface };
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

  const drift = readDrift(match); // [-0.2..0.2]

  return {
    pOdds: pFav,                                   // 0.5 if unknown
    momentum: Math.max(0, Math.min(1, momentum)),  // [0..1]
    drift: 0.5 + drift,                            // store as [0..1]
    setNum: Math.max(0, Math.min(5, setNum)) / 5,  // [0..1]
    live,
  };
}

// Base weights; momentum gets scaled by set-phase
const BASE_W = { pOdds: 0.90, momentum: 0.55, drift: 0.35, setNum: 0.10, live: 0.15 };
const BIAS = -0.55;
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export function score(f, ctx) {
  // Emphasize momentum later in the match
  let phaseBoost = 1.0;
  if (f.setNum <= 0.2) phaseBoost = 0.7;     // early
  else if (f.setNum >= 0.6) phaseBoost = 1.2; // late

  // Slight context tweaks
  let oddsWeight = BASE_W.pOdds;
  if (ctx?.level === 'WTA') oddsWeight += 0.03;           // rely a bit more on odds for WTA
  if (ctx?.level === 'ITF') oddsWeight += 0.02;

  const z =
    oddsWeight * f.pOdds +
    (BASE_W.momentum * phaseBoost) * f.momentum +
    BASE_W.drift * f.drift +
    BASE_W.setNum * f.setNum +
    BASE_W.live * (f.live ? 1 : 0) +
    BIAS;

  // Drift nudge
  const driftCentered = f.drift - 0.5; // [-0.2..0.2]
  const adj = driftCentered > 0.05 ? 0.01 : driftCentered < -0.05 ? -0.01 : 0;

  return Math.max(0, Math.min(1, sigmoid(z) + adj));
}

const CUTS = {
  DEFAULT:   { safe: 0.86, risky: 0.73 },
  ATP:       { safe: 0.87, risky: 0.74 },
  WTA:       { safe: 0.89, risky: 0.76 },
  CHALLENGER:{ safe: 0.86, risky: 0.73 },
  ITF:       { safe: 0.88, risky: 0.75 },
  SLAM:      { safe: 0.88, risky: 0.75 },
};

const SURF_ADJ = {
  grass:  0.010,  // slightly stricter
  clay:   0.005,
  carpet: 0.010,
  indoor: 0.000,
  hard:   0.000,
};

export function toLabel(conf, f, ctx = { level: 'DEFAULT', surface: 'unknown' }) {
  if (!f.live) return { label: 'SOON', kellyLevel: 'LOW' };

  const base = CUTS[ctx.level] || CUTS.DEFAULT;
  const adj  = SURF_ADJ[ctx.surface] || 0;
  const safeCut  = base.safe  + adj;
  const riskyCut = base.risky + Math.max(0, adj - 0.005);

  if (conf >= safeCut)  return { label: 'SAFE',  kellyLevel: 'HIGH' };
  if (conf >= riskyCut) return { label: 'RISKY', kellyLevel: 'MED' };
  if (f.setNum <= 0.2)  return { label: 'SET 1', kellyLevel: 'LOW' };
  return { label: 'AVOID', kellyLevel: 'LOW' };
}