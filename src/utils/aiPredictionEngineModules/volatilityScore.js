// src/utils/aiPredictionEngineModules/volatilityScore.js
// v1.0 — simple, fast, deterministic volatility proxy (0..1)

export default function volatilityScore(match = {}) {
  const players = Array.isArray(match.players) ? match.players : [];
  const a = players?.[0] || {};
  const b = players?.[1] || {};

  const gA = toInt(a.games ?? a.g ?? a.currentGame ?? 0);
  const gB = toInt(b.games ?? b.g ?? b.currentGame ?? 0);
  const totalGames = gA + gB;

  let volatility = 0.5; // neutral

  if (totalGames >= 4 && totalGames <= 10) {
    const diff = Math.abs(gA - gB);
    if (diff <= 1) volatility = 0.8;      // tight, high tension
    else if (diff === 2) volatility = 0.6; // moderate tension
    else volatility = 0.4;                 // one-sided
  } else if (totalGames > 10) {
    volatility = 0.3; // stabilized later in set
  }

  return Math.round(volatility * 100) / 100;
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}