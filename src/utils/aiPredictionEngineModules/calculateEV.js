// src/utils/aiPredictionEngineModules/calculateEV.js

export default function calculateEV({ prob1, prob2 }) {
  if (!prob1 || !prob2) return 0;

  const total = prob1 + prob2;
  if (!Number.isFinite(total) || total <= 0) return 0;

  const p1 = prob1 / total;
  const p2 = prob2 / total;

  const edge = Math.abs(p1 - p2);
  const ev = edge - 0.02;

  return parseFloat(ev.toFixed(4));
}