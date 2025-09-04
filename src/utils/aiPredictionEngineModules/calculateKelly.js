// src/utils/aiPredictionEngineModules/calculateKelly.js

/**
 * Calculate optimal stake using the Kelly Criterion.
 * @param {number} prob - Probability of winning (0–1)
 * @param {number} odds - Decimal odds (e.g. 2.10)
 * @returns {number} Kelly fraction (0–1)
 */
export default function calculateKelly(prob, odds) {
  if (prob <= 0 || prob >= 1 || odds <= 1) return 0;

  const b = odds - 1;
  const q = 1 - prob;

  const kelly = (b * prob - q) / b;

  return Math.max(0, Math.min(1, kelly));
}