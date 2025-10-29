// src/utils/aiPredictionEngineModules/volatilityScore.js
// v1.1 — momentum-aware, fast volatility proxy in [0..1]

export default function volatilityScore(match = {}) {
  const players = Array.isArray(match.players) ? match.players : [];
  const A = players?.[0] || {};
  const B = players?.[1] || {};

  // Games in current set (fallback-friendly)
  const gA = toInt(A.games ?? A.g ?? A.currentGame ?? 0);
  const gB = toInt(B.games ?? B.g ?? B.currentGame ?? 0);
  const totalGames = gA + gB;

  // Momentum signal: who won last set? expect -1 (B), 0 (unknown), +1 (A)
  const lastSetWinner =
    normalizeSign(match.lastSetWinner) ??
    normalizeSign(match.momentum?.lastSetWinner) ??
    0;

  // Tiebreaks are inherently volatile
  const isTiebreak =
    !!match.isTiebreak ||
    toBool(match.score?.tiebreak) ||
    toBool(A.tiebreak) ||
    toBool(B.tiebreak);

  // Base volatility
  let v = 0.5;

  if (isTiebreak) {
    v = 0.9; // peak tension
  } else if (totalGames >= 4 && totalGames <= 10) {
    const diff = Math.abs(gA - gB);
    if (diff <= 1) v = 0.8;         // tight start
    else if (diff === 2) v = 0.6;   // moderate
    else v = 0.4;                   // one-sided
  } else if (totalGames > 10) {
    v = 0.35; // late-set stabilization
  } else {
    v = 0.5; // opening games
  }

  // Momentum gently *reduces* volatility if one side just took a set
  // (markets/players settle briefly after a decisive set)
  // lastSetWinner: +1 = player A, -1 = player B, 0 = unknown
  const momentumMag = Math.abs(lastSetWinner); // 0 or 1
  v = lerp(v, Math.max(0.25, v - 0.15), 0.35 * momentumMag);

  // Clamp and round
  v = clamp(round2(v), 0, 1);
  return v;
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}
function toBool(v) {
  if (typeof v === 'boolean') return v;
  if (v === 1 || v === '1') return true;
  if (v === 0 || v === '0') return false;
  return false;
}
function normalizeSign(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}
function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
function clamp(x, min, max) {
  const n = Number(x);
  if (!Number.isFinite(n)) return min;
  return n < min ? min : n > max ? max : n;
}
function round2(x) { return Math.round((Number(x) || 0) * 100) / 100; }