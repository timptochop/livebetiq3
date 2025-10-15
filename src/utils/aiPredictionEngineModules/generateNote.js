// src/utils/aiPredictionEngineModules/generateNote.js

/**
 * Generates short explanation note for a given AI prediction
 */
export default function generateNote({ ev, confidence, label, fairOdds, momentumBonus }) {
  const { o1, o2 } = fairOdds || {};

  if (!o1 || !o2) return 'No odds data';

  if (label === 'SAFE') {
    return `Strong value detected. EV: ${(ev * 100).toFixed(1)}%, Confidence: ${Math.round(confidence)}%`;
  }

  if (label === 'RISKY') {
    return `Moderate value. EV: ${(ev * 100).toFixed(1)}%, Conf: ${Math.round(confidence)}%`;
  }

  if (label === 'AVOID') {
    return `Low EV or confidence. Avoid betting.`;
  }

  if (label?.startsWith('SET')) {
    return `Match still in ${label}, AI prediction not activated yet.`;
  }

  return `Awaiting AI signal...`;
}