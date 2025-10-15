// src/utils/aiPredictionEngineModules/estimateConfidence.js

export default function estimateConfidence(ev, momentumBonus, surfaceBoost, inputs = {}) {
  let base = 50;

  // Base from EV
  base += ev * 100;

  // Momentum factor
  base += momentumBonus * 100;

  // Surface factor
  base += surfaceBoost * 50;

  // Form adjustment
  if (inputs.formHome !== null && inputs.formAway !== null) {
    const formDelta = inputs.formHome - inputs.formAway;
    base += formDelta * 10;
  }

  // Line movement adjustment
  if (inputs.lineMovement === 'up') base += 3;
  if (inputs.lineMovement === 'down') base -= 3;

  return Math.max(0, Math.min(100, base));
}