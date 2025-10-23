// src/ai/aiEngine.js
import { getCurrentCutoffs } from './adaptTuner';

export function calculateEV(odds1, odds2) {
  const prob1 = 1 / odds1;
  const prob2 = 1 / odds2;
  const totalProb = prob1 + prob2;
  const implied1 = prob1 / totalProb;
  const edge = odds1 * implied1 - 1;
  return edge;
}

export function estimateConfidence(odds1, odds2) {
  const delta = Math.abs(odds1 - odds2);
  if (delta < 0.15) return 45;
  if (delta < 0.30) return 55;
  if (delta < 0.50) return 65;
  if (delta < 0.80) return 75;
  return 85;
}

export function generateLabel(ev, conf) {
  const { minEV, safeConf, riskyConf } = getCurrentCutoffs();
  const c = conf > 1 ? conf / 100 : conf;
  if (ev < minEV || c < riskyConf) return 'AVOID';
  if (c < safeConf) return 'RISKY';
  return 'SAFE';
}

export function generateNote(label, ev, conf) {
  if (label === 'SAFE') return `Strong edge (+${(ev * 100).toFixed(1)}%), confidence ${conf}%.`;
  if (label === 'RISKY') return `Moderate edge, confidence ${conf}%. Monitor odds.`;
  if (label === 'AVOID') return `Low value or volatility detected. Best to skip.`;
  return 'No data.';
}