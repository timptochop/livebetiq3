// src/aiPredictionEngineModules/volatilityScore.js
function clamp01(x) {
  if (Number.isNaN(x)) return 0;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}
function z(score, mean, std) {
  const s = Number(std) > 0 ? (score - mean) / std : 0;
  return Math.max(-3, Math.min(3, s));
}
function normalizeRatio(numer, denom, fallback = 0) {
  const d = Number(denom);
  if (!Number.isFinite(d) || d === 0) return fallback;
  const v = Number(numer) / d;
  return Number.isFinite(v) ? v : fallback;
}

/**
 * @param {Object} ctx
 * @param {number} ctx.setIndex
 * @param {number[]} ctx.games
 * @param {string}  ctx.pointScore
 * @param {number} ctx.recentGameSwing
 * @param {number} ctx.breaksInSet
 * @param {number} ctx.bpFacedThisGame
 * @param {number} ctx.tiebreak
 * @param {number} ctx.lineDriftAbs
 * @param {string} ctx.surface
 * @param {number} ctx.p1HoldPct
 * @param {number} ctx.p2HoldPct
 * @returns {{volatility:number, confMult:number, kellyMult:number, breakdown:object}}
 */
export function computeVolatility(ctx = {}) {
  const setIndex = Number(ctx.setIndex) || 1;
  const g1 = Array.isArray(ctx.games) ? Number(ctx.games[0]) || 0 : 0;
  const g2 = Array.isArray(ctx.games) ? Number(ctx.games[1]) || 0 : 0;
  const gameDiffAbs = Math.abs(g1 - g2);

  const ps = String(ctx.pointScore || '').toUpperCase();
  let pointPressure = 0;
  if (ps.includes('AD') || ps.includes('40-40') || ps.includes('DEUCE')) pointPressure = 1;
  else if (ps.includes('40-30') || ps.includes('30-40')) pointPressure = 0.7;
  else if (ps.includes('30-30')) pointPressure = 0.5;
  else if (ps === '' || ps === '0-0') pointPressure = 0.15;
  else pointPressure = 0.3;

  const lateSet = g1 + g2 >= 9 ? 1 : (g1 + g2 >= 6 ? 0.6 : 0.25);
  const tiebreakBoost = ctx.tiebreak ? 1 : 0;

  const breaksInSet = Math.max(0, Number(ctx.breaksInSet) || 0);
  const bpThisGame = Math.max(0, Number(ctx.bpFacedThisGame) || 0);
  const breakiness = clamp01(0.15 * breaksInSet + 0.2 * Math.min(bpThisGame, 3));

  const swing = Number(ctx.recentGameSwing) || 0;
  const swingNorm = clamp01(Math.abs(swing) / 2);

  const drift = clamp01(Number(ctx.lineDriftAbs) || 0);

  const surf = String(ctx.surface || 'hard').toLowerCase();
  const surfaceVol =
    surf.includes('clay') ? 0.35 :
    surf.includes('grass') ? 0.45 :
    surf.includes('indoor') ? 0.30 :
    0.40;

  const h1 = clamp01(Number(ctx.p1HoldPct) || 0.8);
  const h2 = clamp01(Number(ctx.p2HoldPct) || 0.8);
  const avgHold = (h1 + h2) / 2;
  const serveStability = clamp01(z(avgHold, 0.78, 0.06) * -0.25 + 0.5);

  const leverage = clamp01(1 - normalizeRatio(gameDiffAbs, 6, 0));

  let raw =
    0.25 * pointPressure +
    0.20 * lateSet +
    0.15 * breakiness +
    0.15 * swingNorm +
    0.15 * drift +
    0.05 * tiebreakBoost +
    0.10 * leverage;

  raw = raw * (0.75 + surfaceVol * 0.5) * (0.85 + (1 - serveStability) * 0.3);

  const setAdj = setIndex >= 3 ? 1.08 : setIndex === 2 ? 1.02 : 1.0;

  const volatility = clamp01(raw * setAdj);

  const confMult = clamp01(1.0 - 0.30 * volatility);
  const kellyMult = clamp01(1.0 - 0.45 * volatility);

  return {
    volatility,
    confMult,
    kellyMult,
    breakdown: {
      pointPressure,
      lateSet,
      tiebreakBoost,
      breakiness,
      swingNorm,
      drift,
      surfaceVol,
      serveStability,
      leverage,
      setAdj
    }
  };
}

export default computeVolatility;