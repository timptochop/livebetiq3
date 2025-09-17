// src/utils/analyzeMatch.js
// v1.1 – decider-first EV/Kelly + calibrated confidence + line-movement + momentum + surface
// Σχεδιασμένο να δουλεύει με GoalServe-like match schema (players s1..s5, status, odds?).

/* ---------------------- helpers: generic ---------------------- */
const toNum = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const pct = (x) => Math.round(x * 100);

function safeStr(x) { return String(x || '').toLowerCase(); }
function isUpcoming(status) { return safeStr(status) === 'not started'; }
function isFinishedLike(status) {
  const s = safeStr(status);
  return ['finished','cancelled','retired','abandoned','postponed','walk over'].includes(s);
}
function isLiveStatus(status) { return !!status && !isUpcoming(status) && !isFinishedLike(status); }

function parseSetState(match) {
  // GoalServe μορφή: players[0..1] με s1..s5
  const players = Array.isArray(match.players) ? match.players
                 : Array.isArray(match.player) ? match.player : [];
  const A = players[0] || {}, B = players[1] || {};
  const aSets = [toNum(A.s1), toNum(A.s2), toNum(A.s3), toNum(A.s4), toNum(A.s5)];
  const bSets = [toNum(B.s1), toNum(B.s2), toNum(B.s3), toNum(B.s4), toNum(B.s5)];
  let currentSet = 0;
  for (let i = 0; i < 5; i++) if (aSets[i] !== null || bSets[i] !== null) currentSet = i + 1;

  // sets won so far
  let aWon = 0, bWon = 0;
  for (let i = 0; i < 5; i++) {
    const a = aSets[i], b = bSets[i];
    if (a === null && b === null) continue;
    if (a > b) aWon++;
    else if (b > a) bWon++;
  }

  // best-of inference (αν δεν δίνεται): αν υπάρχει 4ο/5ο set πιθανώς BO5, αλλιώς BO3
  const bestOf = (aSets[3] !== null || bSets[3] !== null || aSets[4] !== null || bSets[4] !== null) ? 5 : 3;

  const isDecider = (bestOf === 3 && currentSet >= 3) || (bestOf === 5 && currentSet >= 5);

  return {
    currentSet: currentSet || 1,
    aWon, bWon,
    bestOf,
    isDecider,
    players,
    p1Name: A.name || A['@name'] || match.home || match.player1 || 'Player 1',
    p2Name: B.name || B['@name'] || match.away || match.player2 || 'Player 2',
  };
}

/* ---------------------- helpers: odds & EV ---------------------- */
// Extract { pre: {o1,o2}, live: {o1,o2} } from various shapes
function extractOdds(match) {
  const odds = match?.odds || match?.raw?.odds || {};
  let pre = { o1: null, o2: null };
  let live = { o1: null, o2: null };

  // Common GoalServe-ish shapes:
  // - odds.pregame?.home / away  (decimal)
  // - odds.live?.home / away
  // - odds.moneyline?.home / away
  // - arrays with {type:'pregame'|'live', home, away}
  const tryRead = (node, key1 = 'home', key2 = 'away') => ({
    o1: toNum(node?.[key1]), o2: toNum(node?.[key2])
  });

  if (odds.pregame) pre = tryRead(odds.pregame);
  if (odds.live)    live = tryRead(odds.live);

  if ((pre.o1 == null || pre.o2 == null) && odds.moneyline)
    pre = tryRead(odds.moneyline);

  // array fallbacks
  if ((pre.o1 == null || pre.o2 == null) && Array.isArray(odds)) {
    const foundPre = odds.find(o => /pre|pregame/i.test(o?.type || ''));
    if (foundPre) pre = tryRead(foundPre);
    const foundLive = odds.find(o => /live|inplay/i.test(o?.type || ''));
    if (foundLive) live = tryRead(foundLive);
  }

  // if only one side provided, mirror invalid to null
  if (pre.o1 == null || pre.o2 == null) pre = { o1: null, o2: null };
  if (live.o1 == null || live.o2 == null) live = { o1: null, o2: null };

  return { pre, live };
}

// Convert decimal odds to de-vigged implied probabilities
function impliedNoVig(o1, o2) {
  if (!o1 || !o2 || o1 <= 1 || o2 <= 1) return { p1: null, p2: null };
  const p1 = 1 / o1, p2 = 1 / o2;
  const s = p1 + p2;
  return s > 0 ? { p1: p1 / s, p2: p2 / s } : { p1: null, p2: null };
}

// Simple model probability blend between pre & live
function modelBlend(preProbs, liveProbs) {
  // δίνουμε περισσότερη βαρύτητα στο live
  const alpha = 0.70; // live weight
  const beta  = 0.30; // pre weight
  const p1 = (alpha * (liveProbs.p1 ?? 0.5)) + (beta * (preProbs.p1 ?? 0.5));
  const p2 = (alpha * (liveProbs.p2 ?? 0.5)) + (beta * (preProbs.p2 ?? 0.5));
  // normalize just in case
  const s = p1 + p2;
  return s > 0 ? { p1: p1 / s, p2: p2 / s } : { p1: 0.5, p2: 0.5 };
}

function kellyFraction(p, oDec) {
  // Kelly: f* = (bp - q) / b,  b = o-1, q=1-p
  if (!oDec || oDec <= 1) return 0;
  const b = oDec - 1;
  const q = 1 - p;
  const f = (b * p - q) / b;
  return clamp(f, 0, 1);
}

/* ---------------------- features: momentum, line drift, surface ---------------------- */
function momentumScore(setState) {
  // απλό momentum: νικητής προηγούμενου set => +3, ηττημένος => -3
  const { players } = setState;
  const s = (i, k) => toNum(players?.[i]?.[`s${k}`]);
  let lastIdx = 0;
  for (let k = 5; k >= 1; k--) {
    const a = s(0, k), b = s(1, k);
    if (a !== null || b !== null) { lastIdx = k; break; }
  }
  if (!lastIdx) return 0;
  const a = s(0, lastIdx) ?? 0, b = s(1, lastIdx) ?? 0;
  if (a > b) return +3;
  if (b > a) return -3;
  return 0;
}
function lineDrift(preProbs, liveProbs) {
  // drift > 0 => ευνοείται ο p1 live σε σχέση με pre
  const dp = (liveProbs.p1 ?? 0.5) - (preProbs.p1 ?? 0.5);
  return dp; // [-1,1]
}
function surfaceAdj(ev, match) {
  // Αν υπάρχει info για surface (clay/grass/hard), κάνε μικρό weight
  const s = safeStr(match.surface || match.court || '');
  if (!ev || !s) return ev;
  if (/clay/.test(s))  return ev * 1.03;
  if (/grass/.test(s)) return ev * 1.02;
  if (/hard|indoor/.test(s)) return ev * 1.01;
  return ev;
}

/* ---------------------- confidence (raw + calibration) ---------------------- */
function rawConfidence({ margin, isDecider, moment, drift, setProgress }) {
  // margin = |p_model - 0.5|
  // Heuristic linear combo -> logistic
  const x = 1.4 * (margin * 2)            // 0..1
          + 0.6 * (isDecider ? 1 : 0)     // +decider
          + 0.15 * clamp(moment / 5, -1, 1)
          + 0.20 * clamp(Math.abs(drift) * 4, 0, 1)
          + 0.10 * clamp(setProgress, 0, 1);
  return sigmoid(2.0 * (x - 0.7)); // > ~0.5 όταν x>0.7
}

function calibrate(p) {
  // Monotonic calibration (piecewise). Tuned generic – βελτιώνεται με ιστορικό.
  // Είσοδος p∈[0,1], έξοδος p'∈[0,1]
  const knots = [
    [0.50, 0.52],
    [0.55, 0.58],
    [0.60, 0.64],
    [0.65, 0.70],
    [0.70, 0.76],
    [0.75, 0.82],
    [0.80, 0.87],
    [0.85, 0.91],
    [0.90, 0.94],
    [0.95, 0.97]
  ];
  if (p <= 0.5) return 0.5;
  if (p >= 0.95) return 0.97;
  let lo = [0.5, 0.52], hi = [0.95, 0.97];
  for (let i = 0; i < knots.length; i++) {
    if (p <= knots[i][0]) { hi = knots[i]; break; }
    lo = knots[i];
  }
  const t = (p - lo[0]) / (hi[0] - lo[0]);
  return clamp(lo[1] + t * (hi[1] - lo[1]), 0.5, 0.99);
}

/* ---------------------- main ---------------------- */
export default function analyzeMatch(match) {
  const status = match?.status || match?.['@status'] || '';
  const live = isLiveStatus(status);
  const setState = parseSetState(match);
  const { currentSet, bestOf, isDecider, p1Name, p2Name } = setState;

  // odds → probabilities
  const { pre, live: liveOdds } = extractOdds(match);
  const preProbs  = impliedNoVig(pre.o1, pre.o2);
  const liveProbs = impliedNoVig(liveOdds.o1, liveOdds.o2);

  // model probs
  const model = modelBlend(preProbs, liveProbs);
  const margin = Math.abs((model.p1 ?? 0.5) - 0.5);

  // επιλέγουμε pick = max(model)
  const pickIdx = (model.p1 >= model.p2) ? 0 : 1;
  const pickName = pickIdx === 0 ? p1Name : p2Name;

  // EV vs live implied
  const p_implied = pickIdx === 0 ? (liveProbs.p1 ?? null) : (liveProbs.p2 ?? null);
  const p_model   = pickIdx === 0 ? (model.p1 ?? 0.5) : (model.p2 ?? 0.5);
  let EV = (p_implied == null) ? null : (p_model - p_implied);

  // Kelly (αν έχουμε αντίστοιχο decimal live odd)
  const o_pick = pickIdx === 0 ? (liveOdds.o1 ?? null) : (liveOdds.o2 ?? null);
  const kelly = (EV !== null && o_pick) ? kellyFraction(p_model, o_pick) : 0;

  // features
  const moment = momentumScore(setState); // -3..+3
  const drift  = lineDrift(preProbs, liveProbs); // [-1..1]
  const setProgress = bestOf === 3 ? (currentSet / 3) : (currentSet / 5);

  // base confidence -> calibrated
  const confRaw = rawConfidence({ margin, isDecider, moment, drift, setProgress });
  const confCal = calibrate(confRaw);

  // Surface adjustment (ήπια) στο EV
  EV = surfaceAdj(EV, match);

  /* ----------- Labeling logic (decider-first) ----------- */
  let label = null;
  // Αν δεν είναι live → upcoming
  if (!live) {
    label = 'STARTS SOON';
  } else {
    // live
    if (!isDecider) {
      // πριν το decider δείξε μόνο SET
      label = `SET ${currentSet}`;
    } else {
      // decider: εφαρμόζουμε thresholds
      // SAFE: EV ≥ 2.0% ΚΑΙ conf ≥ 0.72 ΚΑΙ Kelly 1%–5%
      // RISKY: EV ≥ 1.2% ΚΑΙ conf ≥ 0.62
      // AVOID: αλλιώς
      const evOK_SAFE   = (EV !== null && EV >= 0.020);
      const evOK_RISKY  = (EV !== null && EV >= 0.012);
      const confOK_SAFE  = confCal >= 0.72;
      const confOK_RISKY = confCal >= 0.62;
      const kOK_SAFE     = kelly >= 0.01 && kelly <= 0.05;

      if (evOK_SAFE && confOK_SAFE && kOK_SAFE) label = 'SAFE';
      else if (evOK_RISKY && confOK_RISKY)      label = 'RISKY';
      else                                      label = 'AVOID';
    }
  }

  // Tip/Reason
  const evTxt = EV === null ? 'EV n/a' : `EV ${pct(EV)}%`;
  const confTxt = `Conf ${pct(confCal)}%`;
  const kTxt = kelly ? `Kelly ${(kelly * 100).toFixed(1)}%` : 'Kelly n/a';
  const driftTxt = (Math.abs(drift) >= 0.01)
    ? `Drift ${(drift > 0 ? '+' : '')}${(drift * 100).toFixed(1)}pp`
    : 'Drift ~0';
  const tip = (label === 'SAFE' || label === 'RISKY') ? `Pick: ${pickName}` : null;

  const note = `${bestOf === 3 ? 'BO3' : 'BO5'} · ${live ? `Live ${currentSet}set` : 'Upcoming'} · ${evTxt} · ${confTxt} · ${kTxt} · ${driftTxt}`;

  return {
    label,
    ev: EV ?? 0,
    confidence: confCal,
    kelly,
    pick: tip ? pickName : null,
    tip,
    reason: note,
    setNum: currentSet,
    isLive: live,
  };
}