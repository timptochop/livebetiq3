// src/utils/aiEngineV2.js
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

function toDecimalOdds(v) {
  if (v == null) return null;
  const n = Number(v);
  if (Number.isFinite(n)) {
    if (n > 1.0) return n;
    if (Math.abs(n) >= 100) return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
  }
  const s = String(v).trim();
  if (/^[+-]?\d+$/.test(s)) { const ml = parseInt(s, 10); return ml > 0 ? 1 + ml / 100 : 1 + 100 / Math.abs(ml); }
  return null;
}

function extractDecimalOdds(match) {
  const o = match?.odds ?? match?.liveOdds ?? match?.market ?? null;
  const tryPairs = [
    [o?.p1, o?.p2],[o?.player1, o?.player2],[o?.home, o?.away],[o?.a, o?.b],[o?.one, o?.two],
    [o?.player1?.decimal, o?.player2?.decimal],[o?.player1?.dec, o?.player2?.dec],
    [o?.player1?.ml, o?.player2?.ml],[o?.home?.decimal, o?.away?.decimal],[o?.home?.ml, o?.away?.ml],
  ];
  for (const [x, y] of tryPairs) {
    const d1 = toDecimalOdds(x); const d2 = toDecimalOdds(y);
    if (d1 && d2) return { d1, d2 };
  }
  return { d1: null, d2: null };
}

function impliedProb(decimal) { return decimal ? 1 / decimal : null; }

function readSetArrays(players = []) {
  const a = players[0] || {}, b = players[1] || {};
  const grab = (p) => [toNum(p.s1), toNum(p.s2), toNum(p.s3), toNum(p.s4), toNum(p.s5)];
  const sA = grab(a), sB = grab(b);
  let setIdx = -1;
  for (let i = 0; i < 5; i++) if (sA[i] != null || sB[i] != null) setIdx = i;
  return { sA, sB, setIdx };
}

function readDrift(match) {
  const hist = match?.oddsHistory ?? match?.odds?.history ?? match?.liveOddsHistory ?? [];
  if (!Array.isArray(hist) || hist.length < 2) return 0;
  const last = hist[hist.length - 1], prev = hist[hist.length - 2];
  const dLast = toDecimalOdds(last?.fav ?? last?.p1 ?? last);
  const dPrev = toDecimalOdds(prev?.fav ?? prev?.p1 ?? prev);
  if (!dLast || !dPrev) return 0;
  const pLast = impliedProb(dLast), pPrev = impliedProb(dPrev);
  const drift = pLast - pPrev;
  return Math.max(-0.2, Math.min(0.2, drift));
}

function readServer(match, players = [], pFav = 0.5) {
  const srv = match?.server ?? match?.serve ?? match?.['@server'] ?? null;
  const p1Name = players?.[0]?.name || players?.[0]?.['@name'] || "";
  const p2Name = players?.[1]?.name || players?.[1]?.['@name'] || "";

  let server = 0; // 0 unknown, 1 p1, 2 p2
  if (srv === 1 || srv === "1" || srv === p1Name) server = 1;
  else if (srv === 2 || srv === "2" || srv === p2Name) server = 2;

  const favIsP1 = pFav >= 0.5;
  if (server === 0) return 0.5;
  const favServing = (server === 1 && favIsP1) || (server === 2 && !favIsP1);
  // small bounded edge around 0.5
  return favServing ? 0.53 : 0.47;
}

export function extractContext(match = {}) {
  const raw = (match.categoryName ?? match.category ?? match['@category'] ??
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

  const players = Array.isArray(match.players) ? match.players :
                  Array.isArray(match.player) ? match.player : [];

  const { sA, sB, setIdx } = readSetArrays(players);
  const setNumRaw = (setIdx >= 0 ? setIdx + 1 : 0);
  const gamesA = sA.reduce((a, x) => a + (x || 0), 0);
  const gamesB = sB.reduce((a, x) => a + (x || 0), 0);
  const totalGames = gamesA + gamesB || 1;
  const momentum = 0.5 + (gamesA - gamesB) / (2 * totalGames);

  const curA = setIdx >= 0 ? (sA[setIdx] || 0) : 0;
  const curB = setIdx >= 0 ? (sB[setIdx] || 0) : 0;
  const curTotal = Math.max(1, curA + curB);
  const microMomentum = 0.5 + (curA - curB) / (2 * curTotal);

  const { d1, d2 } = extractDecimalOdds(match);
  const p1 = impliedProb(d1), p2 = impliedProb(d2);
  const pFav = p1 && p2 ? Math.max(p1, p2) : 0.5;

  const drift = readDrift(match);
  const serveAdv = readServer(match, players, pFav);

  // clutch window (late set & close score)
  const isLate = curTotal >= 8; // typically 5-3, 4-4, ...
  const isTight = Math.abs(curA - curB) <= 1;
  const clutch = live && setIdx >= 0 && isLate && isTight ? 1 : 0;

  return {
    pOdds: pFav,              // 0..1
    momentum: Math.max(0, Math.min(1, momentum)),
    micro: Math.max(0, Math.min(1, microMomentum)),
    serve: Math.max(0, Math.min(1, serveAdv)),
    drift: 0.5 + drift,      // 0..1, centered later
    setNum: Math.max(0, Math.min(5, setNumRaw)) / 5, // 0..1
    live,
    clutch,                   // 0/1
  };
}

const BASE_W = {
  pOdds: 0.88,
  momentum: 0.46,
  micro: 0.40,
  drift: 0.32,
  serve: 0.12,
  setNum: 0.08,
  live: 0.12,
  clutch: 0.10,
};
const BIAS = -0.55;
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

export function score(f, ctx) {
  let phaseBoost = 1.0;
  if (f.setNum <= 0.2) phaseBoost = 0.75;     // avoid early noise
  else if (f.setNum >= 0.6) phaseBoost = 1.15; // late-set confidence

  let oddsWeight = BASE_W.pOdds;
  if (ctx?.level === 'WTA') oddsWeight += 0.03;
  if (ctx?.level === 'ITF') oddsWeight += 0.02;

  // clutch boosts micro + drift modestly
  const clutchMicro = f.clutch ? 1.12 : 1.0;
  const clutchDrift = f.clutch ? 1.08 : 1.0;

  const z =
    oddsWeight * f.pOdds +
    (BASE_W.momentum * phaseBoost) * f.momentum +
    (BASE_W.micro * clutchMicro) * f.micro +
    (BASE_W.drift * clutchDrift) * f.drift +
    BASE_W.serve * f.serve +
    BASE_W.setNum * f.setNum +
    BASE_W.live * (f.live ? 1 : 0) +
    BASE_W.clutch * (f.clutch ? 1 : 0) +
    BIAS;

  const driftCentered = f.drift - 0.5;
  const adj = driftCentered > 0.05 ? 0.01 : driftCentered < -0.05 ? -0.01 : 0;
  return Math.max(0, Math.min(1, sigmoid(z) + adj));
}

const CUTS = {
  DEFAULT:   { safe: 0.865, risky: 0.735 },
  ATP:       { safe: 0.875, risky: 0.745 },
  WTA:       { safe: 0.895, risky: 0.765 },
  CHALLENGER:{ safe: 0.865, risky: 0.735 },
  ITF:       { safe: 0.885, risky: 0.755 },
  SLAM:      { safe: 0.885, risky: 0.755 },
};

const SURF_ADJ = { grass: 0.010, clay: 0.005, carpet: 0.010, indoor: 0.000, hard: 0.000 };

export function toLabel(conf, f, ctx = { level: 'DEFAULT', surface: 'unknown' }, nudges = { safeAdj: 0, riskyAdj: 0 }) {
  if (!f.live) return { label: 'SOON', kellyLevel: 'LOW' };

  const base = CUTS[ctx.level] || CUTS.DEFAULT;
  const adj  = SURF_ADJ[ctx.surface] || 0;

  let safeCut  = base.safe  + adj + (nudges.safeAdj || 0);
  let riskyCut = base.risky + Math.max(0, adj - 0.005) + (nudges.riskyAdj || 0);

  // slight relaxation in clutch windows when micro-momentum is high
  if (f.clutch && f.micro >= 0.60) {
    safeCut  -= 0.006;
    riskyCut -= 0.004;
  }

  safeCut  = Math.max(0.60, Math.min(0.98, safeCut));
  riskyCut = Math.max(0.55, Math.min(safeCut - 0.02, riskyCut));

  if (conf >= safeCut)  return { label: 'SAFE',  kellyLevel: 'HIGH' };
  if (conf >= riskyCut) return { label: 'RISKY', kellyLevel: 'MED' };
  if (f.setNum <= 0.2)  return { label: 'SET 1', kellyLevel: 'LOW' };
  return { label: 'AVOID', kellyLevel: 'LOW' };
}