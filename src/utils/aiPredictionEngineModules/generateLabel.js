// src/utils/aiPredictionEngineModules/generateLabel.js

export default function generateLabel({ ev, confidence }) {
  if (ev >= 0.025 && confidence >= 60) return 'SAFE';
  if (ev >= 0.015 && confidence >= 54) return 'RISKY';
  if (ev <= -0.01 || confidence < 50) return 'AVOID';
  return 'SET';
}