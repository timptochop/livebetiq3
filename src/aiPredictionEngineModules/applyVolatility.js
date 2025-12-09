// src/aiPredictionEngineModules/applyVolatility.js
// v3.2 – volatility-aware wrapper for predictions

import computeVolatility from './volatilityScore';

/**
 * Simple clamp between min and max.
 * @param {number} x
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(x, min = 0, max = 1) {
  const v = Number(x);
  if (!Number.isFinite(v)) return min;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

/**
 * Apply volatility adjustments on top of an existing prediction.
 *
 * @param {Object} prediction
 *   - ev: number (base expected value)
 *   - confidence: number (0–1)
 *   - kelly: number (0–1, fraction of bankroll)
 *   - any other fields (label, tip, etc.) are passed-through
 *
 * @param {Object} ctx  (live match context passed to volatilityScore)
 *   - setIndex, games[], pointScore, recentGameSwing, breaksInSet,
 *     bpFacedThisGame, tiebreak, lineDriftAbs, surface,
 *     p1HoldPct, p2HoldPct, ...
 *
 * @returns {Object} adjusted prediction with volatility + breakdown
 */
export function applyVolatility(prediction = {}, ctx = {}) {
  // 1) Compute volatility + multipliers
  const vol = computeVolatility(ctx);

  const baseConf = Number(prediction.confidence);
  const baseKelly = Number(prediction.kelly);

  // 2) Adjust confidence / kelly via volatility multipliers
  const adjustedConfidence = clamp(
    Number.isFinite(baseConf) ? baseConf * vol.confMult : vol.confMult,
    0,
    1
  );

  const adjustedKelly = clamp(
    Number.isFinite(baseKelly) ? baseKelly * vol.kellyMult : vol.kellyMult,
    0,
    1
  );

  const out = {
    ...prediction,
    confidence: adjustedConfidence,
    kelly: adjustedKelly,
    volatility: vol.volatility,
    volatilityConfMult: vol.confMult,
    volatilityKellyMult: vol.kellyMult,
    volatilityBreakdown: vol.breakdown,
  };

  // 3) Dev-time diagnostics (for LBQ Logger / console review)
  try {
    if (typeof console !== 'undefined' && console.table) {
      console.table([
        {
          matchId: prediction.matchId || ctx.matchId || 'unknown',
          label: prediction.label || 'n/a',
          ev: prediction.ev,
          baseConfidence: baseConf,
          baseKelly,
          volatility: vol.volatility,
          confMult: vol.confMult,
          kellyMult: vol.kellyMult,
          adjConfidence: adjustedConfidence,
          adjKelly: adjustedKelly,
          setIndex: ctx.setIndex,
          games: Array.isArray(ctx.games) ? ctx.games.join('-') : '',
          pointScore: ctx.pointScore,
          surface: ctx.surface,
          lineDriftAbs: ctx.lineDriftAbs,
        },
      ]);
    }
  } catch {
    // never block predictions because of logging
  }

  return out;
}

export default applyVolatility;