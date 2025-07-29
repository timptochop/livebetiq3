// src/ai/aiEngine.js

// Υπολογισμός Expected Value (EV) βάσει αποδόσεων
export function calculateEV(odds1, odds2) {
  const prob1 = 1 / odds1;
  const prob2 = 1 / odds2;
  const totalProb = prob1 + prob2;

  const implied1 = prob1 / totalProb;
  const edge = odds1 * implied1 - 1;
  return edge;
}

// Υπολογισμός Confidence (με βάση odds gap και volatility simulation)
export function estimateConfidence(odds1, odds2) {
  const delta = Math.abs(odds1 - odds2);
  if (delta < 0.15) return 45;
  if (delta < 0.30) return 55;
  if (delta < 0.50) return 65;
  if (delta < 0.80) return 75;
  return 85;
}

// AI Labeling ανάλογα με EV & Confidence
export function generateLabel(ev, conf) {
  if (ev < 0 || conf < 50) return "AVOID";
  if (ev < 0.03 || conf < 60) return "RISKY";
  return "SAFE";
}

// AI Notes — summary για user σε φυσική γλώσσα
export function generateNote(label, ev, conf) {
  if (label === "SAFE") return `Strong edge (+${(ev * 100).toFixed(1)}%), confidence ${conf}%.`;
  if (label === "RISKY") return `Moderate edge, confidence ${conf}%. Monitor odds.`;
  if (label === "AVOID") return `Low value or volatility detected. Best to skip.`;
  return "No data.";
}