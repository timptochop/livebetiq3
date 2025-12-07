// src/utils/aiPredictionEngineModules/estimateConfidence.js

export default function estimateConfidence(ev, momentumBonus, surfaceBoost, inputs = {}) {
  let base = 50;

  if (Number.isFinite(ev)) {
    base += ev * 100;
  }

  if (Number.isFinite(momentumBonus)) {
    base += momentumBonus * 100;
  }

  if (Number.isFinite(surfaceBoost)) {
    base += surfaceBoost * 50;
  }

  if (
    inputs &&
    inputs.formHome !== null &&
    inputs.formAway !== null &&
    Number.isFinite(inputs.formHome) &&
    Number.isFinite(inputs.formAway)
  ) {
    const formDelta = inputs.formHome - inputs.formAway;
    base += formDelta * 10;
  }

  if (inputs && inputs.lineMovement === 'up') base += 3;
  if (inputs && inputs.lineMovement === 'down') base -= 3;

  return Math.max(0, Math.min(100, base));
}