// src/utils/aiPredictionEngineModules/detectLineMovement.js

/**
 * Detects line movement between pregame and current implied probabilities.
 * Adds a boost or penalty to confidence depending on market drift.
 *
 * @param {number} preProb1 - Pregame implied probability for player 1 (0–1)
 * @param {number} curProb1 - Current live implied probability for player 1 (0–1)
 * @param {number} preProb2 - Pregame implied probability for player 2 (0–1)
 * @param {number} curProb2 - Current live implied probability for player 2 (0–1)
 * @param {string} pick - Which player is picked: 'player1' or 'player2'
 * @returns {{
 *   driftPercent: number,
 *   confidenceBoost: number,
 *   comment: string
 * }}
 */
export default function detectLineMovement(preProb1, curProb1, preProb2, curProb2, pick) {
  const drift = (pre, cur) => {
    if (pre <= 0 || pre >= 1 || cur <= 0 || cur >= 1) return 0;
    return ((cur - pre) / pre) * 100;
  };

  const drift1 = drift(preProb1, curProb1);
  const drift2 = drift(preProb2, curProb2);

  let boost = 0;
  let comment = '';
  let driftPercent = 0;

  if (pick === 'player1') {
    driftPercent = drift1;
    if (drift1 > 2) {
      boost = 2;
      comment = 'Line moved in favor of player 1';
    } else if (drift1 < -2) {
      boost = -2;
      comment = 'Line moved against player 1';
    }
  } else if (pick === 'player2') {
    driftPercent = drift2;
    if (drift2 > 2) {
      boost = 2;
      comment = 'Line moved in favor of player 2';
    } else if (drift2 < -2) {
      boost = -2;
      comment = 'Line moved against player 2';
    }
  }

  return {
    driftPercent: Number(driftPercent.toFixed(2)),
    confidenceBoost: boost,
    comment
  };
}