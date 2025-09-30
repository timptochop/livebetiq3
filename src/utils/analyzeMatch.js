// src/utils/analyzeMatch.js
// Thin wrapper to keep LiveTennis integration stable.

import classify from "./aiPredictionEngine";

export default function analyzeMatch(match) {
  try {
    const out = classify(match || {});
    return {
      label: out.label || 'SOON',
      conf: typeof out.conf === 'number' ? out.conf : 0.5,
      tip: out.tip,
      kellyLevel: out.kellyLevel || 'LOW',
      info: out.features || {},
    };
  } catch (e) {
    console.warn('[analyzeMatch] fallback:', e?.message);
    return { label: 'SOON', conf: 0.5, kellyLevel: 'LOW' };
  }
}