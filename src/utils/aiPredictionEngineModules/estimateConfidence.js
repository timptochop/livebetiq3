// src/utils/aiPredictionEngineModules/estimateConfidence.js

export default function estimateConfidence(prob1, prob2, winner) {
  if (!prob1 || !prob2 || prob1 <= 0 || prob2 <= 0) return 0;

  let baseConfidence = Math.abs(prob1 - prob2) * 100;

  // Boost confidence if winner aligns with higher probability
  if (winner === 'player1' && prob1 > prob2) baseConfidence += 5;
  if (winner === 'player2' && prob2 > prob1) baseConfidence += 5;

  // Normalize between 0 and 100
  return Math.min(100, Math.max(0, Math.round(baseConfidence)));
}