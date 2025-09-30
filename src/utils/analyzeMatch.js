// src/utils/analyzeMatch.js
import predict from './predictor';

export default function analyzeMatch(m) {
  try {
    const out = predict(m) || {};
    // επιστρέφουμε πάντα ασφαλές αντικείμενο για UI
    return {
      label: out.label || null,
      tip: out.tip || null,
      prob: typeof out.prob === 'number' ? out.prob : null,
      kellyLevel: out.kellyLevel || null,
      confidence: typeof out.confidence === 'number' ? out.confidence : null,
      winner: out.winner || null,
    };
  } catch (e) {
    // Σε αποτυχία, μην σπάσεις UI
    return {
      label: null,
      tip: null,
      prob: null,
      kellyLevel: null,
      confidence: null,
      winner: null,
    };
  }
}