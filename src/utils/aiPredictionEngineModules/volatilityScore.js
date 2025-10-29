// src/utils/aiPredictionEngineModules/volatilityScore.js
// v1.2 — momentum-aware volatility (0..1)

export default function volatilityScore(match = {}) {
  const players = Array.isArray(match.players) ? match.players : [];
  const a = players?.[0] || {};
  const b = players?.[1] || {};

  const gA = getGames(a);
  const gB = getGames(b);
  const totalGames = gA + gB;

  let vol = 0.5;

  if (totalGames >= 4 && totalGames <= 10) {
    const diff = Math.abs(gA - gB);
    if (diff <= 1) vol = 0.8;
    else if (diff === 2) vol = 0.6;
    else vol = 0.4;
  } else if (totalGames > 10) {
    vol = 0.3;
  }

  const setsA = getSetsWon(a);
  const setsB = getSetsWon(b);
  const lastWinner = lastSetWinner(match);

  let momentumBoost = 0;
  if (lastWinner !== null) {
    const leaderNow = gA === gB ? null : (gA > gB ? 0 : 1);
    if (leaderNow === null) {
      momentumBoost += 0.08;
    } else if (leaderNow !== lastWinner) {
      momentumBoost += 0.12;
    } else {
      momentumBoost += 0.02;
    }
  }

  const setDiff = Math.abs(setsA - setsB);
  if (setDiff === 0 && totalGames >= 4 && totalGames <= 9) momentumBoost += 0.06;
  if (setDiff >= 1 && totalGames <= 3) momentumBoost += 0.04;

  let out = clamp01(vol + momentumBoost);
  out = clamp(out, 0.2, 0.9);
  return round2(out);
}

function getGames(p) {
  const cands = [p.games, p.g, p.currentGame, p.game, p.liveGames];
  for (const v of cands) {
    const n = toInt(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function getSetsWon(p) {
  const cands = [p.setsWon, p.sets, p.s, p.wonSets];
  for (const v of cands) {
    const n = toInt(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function lastSetWinner(match) {
  const sets = Array.isArray(match.sets) ? match.sets : null;
  if (!sets || sets.length === 0) return null;
  const last = sets[sets.length - 1];
  if (!last) return null;
  if (typeof last.winner === 'number') return last.winner;
  const a = toInt(last.a ?? last.p1 ?? last.left);
  const b = toInt(last.b ?? last.p2 ?? last.right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a === b) return null;
  return a > b ? 0 : 1;
}

function toInt(v) {
  if (v == null) return NaN;
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : NaN;
}

function clamp01(x) { return clamp(Number(x) || 0, 0, 1); }
function clamp(x, min, max) { return x < min ? min : x > max ? max : x; }
function round2(x) { return Math.round(x * 100) / 100; }