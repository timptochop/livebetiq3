// src/utils/predictor.js
function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
}

function normStatus(s) {
  return String(s || '').toLowerCase();
}

function currentSetIndex(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [toNum(a.s1), toNum(a.s2), toNum(a.s3), toNum(a.s4), toNum(a.s5)];
  const sB = [toNum(b.s1), toNum(b.s2), toNum(b.s3), toNum(b.s4), toNum(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k || 0; // 1..5 or 0
}

function setsWon(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [toNum(a.s1), toNum(a.s2), toNum(a.s3), toNum(a.s4), toNum(a.s5)];
  const sB = [toNum(b.s1), toNum(b.s2), toNum(b.s3), toNum(b.s4), toNum(b.s5)];
  let A = 0, B = 0;
  for (let i = 0; i < 5; i++) {
    const ga = sA[i], gb = sB[i];
    if (ga === null && gb === null) continue;
    if (ga !== null && gb !== null) {
      if (ga > gb) A++; else if (gb > ga) B++;
    }
  }
  return { A, B, sA, sB };
}

function gamesInSet(sArr, idx1) {
  if (!idx1) return { g: null, ok: false };
  const v = toNum(sArr[idx1 - 1]);
  return { g: v, ok: v !== null };
}

function scoreLead(a, b) {
  if (a == null || b == null) return { diff: 0, leader: 0 };
  const diff = Math.abs(a - b);
  const leader = a > b ? 1 : (b > a ? 2 : 0);
  return { diff, leader };
}

const FINISHED = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);
const UPCOMING = 'not started';

export function predict(match) {
  const status = normStatus(match?.status || match?.['@status']);
  const players = Array.isArray(match?.players) ? match.players
    : (Array.isArray(match?.player) ? match.player : []);
  const setIdx = currentSetIndex(players); // 0 if unknown
  const { A: setsA, B: setsB, sA, sB } = setsWon(players);

  // Live flags
  const isUpcoming = status === UPCOMING;
  const isFinished = FINISHED.has(status);
  const isLive = !!status && !isUpcoming && !isFinished;

  // Current set games and lead
  const { g: gA, ok: okA } = gamesInSet(sA, setIdx);
  const { g: gB, ok: okB } = gamesInSet(sB, setIdx);
  const { diff: gameDiff, leader: gameLeader } = scoreLead(gA, gB);

  // Set lead (who leads in sets)
  const setLeader = setsA > setsB ? 1 : (setsB > setsA ? 2 : 0);
  const setDiff = Math.abs(setsA - setsB);

  // Confidence score 0..1
  let score = 0.5;

  // Phase weighting
  if (isUpcoming) score -= 0.12;
  if (isFinished) score = 0.0;

  // Set advantage
  if (setDiff >= 1) score += 0.12;
  if (setDiff >= 2) score += 0.08;

  // In-set lead (break-like advantage)
  if (isLive && okA && okB) {
    if (Math.max(gA, gB) >= 4 && gameDiff >= 2) score += 0.18; // strong
    else if (gameDiff === 1 && Math.max(gA, gB) >= 3) score += 0.06; // small
  }

  // Decider emphasis
  if (isLive && setIdx >= 3) score += 0.06;

  // Early live but no separation → reduce
  if (isLive && setIdx === 1 && (gameDiff <= 1)) score -= 0.06;

  // Clamp
  score = Math.max(0, Math.min(1, score));

  // Labeling
  let label = 'RISKY';
  if (!isLive && !isUpcoming) label = 'AVOID';
  if (isUpcoming) label = 'SOON';
  if (isLive) {
    const strongSetLead = setDiff >= 1 && setIdx >= 2;
    const strongGameLead = Math.max(gA ?? 0, gB ?? 0) >= 4 && gameDiff >= 2;
    if (strongSetLead && strongGameLead) label = 'SAFE';
    else if (score < 0.42) label = 'AVOID';
    else label = 'RISKY';
  }

  // Kelly level from score
  let kellyLevel = 'LOW';
  if (score >= 0.75) kellyLevel = 'HIGH';
  else if (score >= 0.55) kellyLevel = 'MED';

  // Tip text (always provide for SAFE/RISKY)
  let tip = null;
  if (label === 'SAFE' || label === 'RISKY') {
    if (isLive && setIdx > 0 && gameLeader !== 0) {
      const leaderName = gameLeader === 1
        ? (players?.[0]?.name || players?.[0]?.['@name'] || 'P1')
        : (players?.[1]?.name || players?.[1]?.['@name'] || 'P2');
      const setTitle = `set ${setIdx}`;
      if (Math.max(gA ?? 0, gB ?? 0) >= 4 && gameDiff >= 2) {
        tip = `${leaderName} up a break in ${setTitle}`;
      } else if (gameDiff === 1) {
        tip = `${leaderName} slight edge in ${setTitle}`;
      } else {
        tip = `Momentum unclear – monitor`;
      }
    } else if (isUpcoming) {
      tip = `Await live data`;
    } else {
      tip = `Monitor market/odds`;
    }
  }

  return {
    label,
    kellyLevel,
    tip,
    score,          // 0..1 for future tuning
    meta: {
      isLive, isUpcoming, isFinished,
      setIdx, setsA, setsB, gA, gB, gameDiff, setDiff
    }
  };
}

export default predict;