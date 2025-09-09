// src/utils/aiPredictionEngineModules/calculateEV.js

export default function calculateEV({ prob1, prob2 }) {
  if (!prob1 || !prob2) return 0;

  // Normalize
  const total = prob1 + prob2;
  const p1 = prob1 / total;
  const p2 = prob2 / total;

  // Calculate edge
  const edge = Math.abs(p1 - p2);
  const ev = edge - 0.02; // House edge buffer

  return parseFloat(ev.toFixed(4));
}