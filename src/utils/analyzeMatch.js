// src/utils/analyzeMatch.js
// Thin wrapper: ενώνει το UI με τον predictor και εγγυάται σταθερό shape αποτελέσματος.
import predictor from './predictor';

export default function analyzeMatch(m = {}) {
  try {
    return predictor(m);
  } catch (e) {
    // Fail-safe ώστε να μην “σπάει” ποτέ το UI
    return { label: 'AVOID', conf: 0.5, kellyLevel: 'LOW', tip: '' };
  }
}