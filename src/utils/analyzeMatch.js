// src/utils/analyzeMatch.js
import predict from './predictor';

export default function analyzeMatch(m = {}) {
  const out = predict(m) || {};

  // Προστασία από “μαζικό AVOID”
  let label = out.label ?? 'PENDING';
  if (label === 'AVOID') label = 'PENDING';

  return {
    label,                                  // 'SAFE' | 'RISKY' | 'PENDING' | 'SET n'
    conf: Number.isFinite(out.conf) ? out.conf : 0,
    kellyLevel: out.kellyLevel || null,     // 'HIGH' | 'MED' | 'LOW' | null
    tip: out.tip || null,
    reasons: out.reasons || [],
    raw: out.raw || null,
  };
}