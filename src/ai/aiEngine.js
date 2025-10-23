// src/ai/aiEngine.js
import { getCurrentCutoffs } from './adaptTuner';

export function calculateEV(odds1, odds2) {
  const prob1 = 1 / Number(odds1);
  const prob2 = 1 / Number(odds2);
  const totalProb = prob1 + prob2;
  const implied1 = totalProb > 0 ? prob1 / totalProb : 0;
  return Number(odds1) * implied1 - 1;
}

export function estimateConfidence(odds1, odds2) {
  const a = Number(odds1), b = Number(odds2);
  const delta = Math.abs(a - b);
  if (delta < 0.15) return 45;
  if (delta < 0.30) return 55;
  if (delta < 0.50) return 65;
  if (delta < 0.80) return 75;
  return 85;
}

export function generateLabel(ev, conf) {
  const c = getCurrentCutoffs();
  if (ev < 0 || conf < 50) return 'AVOID';
  if (ev >= c.minEV && conf >= c.safeConf * 100) return 'SAFE';
  if (ev >= c.minEV && conf >= c.riskyConf * 100) return 'RISKY';
  return 'AVOID';
}

export function generateNote(label, ev, conf) {
  if (label === 'SAFE') return `Strong edge (+${(ev * 100).toFixed(1)}%), confidence ${conf}%.`;
  if (label === 'RISKY') return `Moderate edge, confidence ${conf}%. Monitor odds.`;
  if (label === 'AVOID') return `Low value or volatility detected. Best to skip.`;
  return 'No data.';
}