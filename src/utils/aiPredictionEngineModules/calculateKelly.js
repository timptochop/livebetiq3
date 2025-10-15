// src/utils/aiPredictionEngineModules/calculateKelly.js

export default function calculateKelly(ev, confidence) {
  if (!ev || ev <= 0 || !confidence) return 0;

  const edge = ev;
  const probability = confidence / 100;

  const kelly = (edge * probability) / (1 - probability);

  return Math.max(0, kelly); // Ensure no negative betting
}