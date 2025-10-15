// src/utils/aiPredictionEngineModules/generateLabel.js

/**
 * Classifies match into one of: SAFE, RISKY, AVOID, SOON, or SET X
 */
export default function generateLabel({ ev, confidence, setNumber }) {
  if (setNumber < 3) {
    return `SET ${setNumber || 1}`; // Fallback to SET 1 if undefined
  }

  if (ev > 0.035 && confidence > 65) return 'SAFE';
  if (ev > 0.025 && confidence > 55) return 'RISKY';
  if (ev < 0.015 || confidence < 45) return 'AVOID';

  return 'SET 3';
}