// src/utils/aiPredictionEngineModules/surfaceAdjustment.js

/**
 * Adjusts EV and Confidence based on the match surface type.
 *
 * @param {'hard'|'clay'|'grass'|string} surface - Type of court surface.
 * @param {object} playerStats - Object with surface-specific win rates or performance indicators.
 * @param {object} opponentStats - Same structure as playerStats.
 * @returns {{
 *   evBoost: number,
 *   confidenceBoost: number,
 *   comment: string
 * }}
 */
export default function surfaceAdjustment(surface, playerStats = {}, opponentStats = {}) {
  const normalize = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
  };

  const key = String(surface || '').toLowerCase();
  const playerWinRate = normalize(playerStats[key]);
  const opponentWinRate = normalize(opponentStats[key]);

  let evBoost = 0;
  let confidenceBoost = 0;
  let comment = '';

  if (playerWinRate !== null && opponentWinRate !== null) {
    const delta = playerWinRate - opponentWinRate;

    if (delta > 0.15) {
      evBoost = 0.02;
      confidenceBoost = 4;
      comment = `Player performs significantly better on ${key}`;
    } else if (delta < -0.15) {
      evBoost = -0.02;
      confidenceBoost = -4;
      comment = `Player underperforms on ${key} vs opponent`;
    }
  }

  return {
    evBoost: Number(evBoost.toFixed(3)),
    confidenceBoost,
    comment
  };
}