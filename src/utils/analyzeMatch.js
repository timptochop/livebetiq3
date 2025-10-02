// src/utils/analyzeMatch.js
import runPredictor from './predictor';

export default function analyzeMatch(m = {}) {
  try {
    return runPredictor(m) || { label: 'PENDING', conf: 0.5, kellyLevel: 'LOW' };
  } catch {
    return { label: 'PENDING', conf: 0.5, kellyLevel: 'LOW' };
  }
}