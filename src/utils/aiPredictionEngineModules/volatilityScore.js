// src/utils/aiPredictionEngineModules/volatilityScore.js

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}
function diffAbs(a, b) {
  return Math.abs(num(a) - num(b));
}
function pick(...candidates) {
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function gamesVolatility(aGames, bGames) {
  const gA = num(aGames);
  const gB = num(bGames);
  const total = gA + gB;
  const diff = Math.abs(gA - gB);
  if (total <= 2) return 0.7;
  if (total <= 10) {
    const tight = clamp(1 - diff / 4, 0, 1);
    return 0.4 + 0.5 * tight;
  }
  return 0.3;
}

function driftVolatility(match) {
  const pre1 = pick(match?.preProb1, match?.pre_p1, match?.preFavProb);
  const cur1 = pick(match?.prob1, match?.live_p1, match?.favProb);
  const pre2 = pick(match?.preProb2, match?.pre_p2);
  const cur2 = pick(match?.prob2, match?.live_p2);

  const d1 = Number.isFinite(pre1) && Number.isFinite(cur1) ? Math.abs(cur1 - pre1) : 0;
  const d2 = Number.isFinite(pre2) && Number.isFinite(cur2) ? Math.abs(cur2 - pre2) : 0;
  const direct = Math.max(
    num(match?.oddsDrift),
    num(match?.lineDrift),
    num(match?.drift)
  );

  const probDrift = Math.max(d1, d2);
  const normProb = clamp(probDrift / 0.20, 0, 1);
  const normDirect = clamp(direct / 0.20, 0, 1);
  return Math.max(normProb, normDirect);
}

function momentumVolatility(match) {
  const streakA = Math.max(0, num(match?.streakA || match?.players?.[0]?.streak));
  const streakB = Math.max(0, num(match?.streakB || match?.players?.[1]?.streak));
  const lastSet = String(match?.lastSetWinner || match?.lastSet || '').toUpperCase();
  const swing = (streakA >= 2 || streakB >= 2) ? 1 : 0;
  const setSwing = lastSet === 'A' || lastSet === 'B' ? 1 : 0;
  return clamp(0.5 * swing + 0.5 * setSwing, 0, 1);
}

function scoreFromMatch(match = {}) {
  const players = Array.isArray(match.players) ? match.players : [];
  const a = players[0] || {};
  const b = players[1] || {};

  const gA = pick(a.games, a.g, a.currentGame, match?.gamesA, 0);
  const gB = pick(b.games, b.g, b.currentGame, match?.gamesB, 0);

  const vGames = gamesVolatility(gA, gB);
  const vDrift = driftVolatility(match);
  const vMom = momentumVolatility(match);

  const wG = 0.6, wD = 0.3, wM = 0.1;
  const score = clamp(wG * vGames + wD * vDrift + wM * vMom, 0, 1);
  return Math.round(score * 100) / 100;
}

export function volatilityAdjustments(match = {}) {
  const score = scoreFromMatch(match);
  const confMult = clamp(1 - 0.35 * score, 0.65, 1);
  const kellyMult = clamp(1 - 0.50 * score, 0.50, 1);
  return { score, confMult, kellyMult };
}

export default function volatilityScore(match = {}) {
  return scoreFromMatch(match);
}