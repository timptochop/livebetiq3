// src/utils/aiPredictionEngineModules/surfaceAdjustment.js

export default function surfaceAdjustment(surface) {
  switch (surface) {
    case 'clay':
      return 0.002; // Slight positive boost for consistent play
    case 'grass':
      return -0.002; // Slight penalty due to volatility
    case 'hard':
      return 0.001; // Neutral to slight boost
    default:
      return 0; // No data → no adjustment
  }
}