export function calculateEV(odds1, odds2, fallback) {
  if (typeof odds1 === 'number' && typeof odds2 === 'number') {
    const p1 = 1 / odds1, p2 = 1 / odds2;
    const edge = Math.max(p1, p2) - 0.5;
    return Math.max(-20, Math.min(20, edge * 100));
  }
  if (fallback?.probability != null && fallback?.odds != null) {
    return (fallback.probability * fallback.odds - 1) * 100;
  }
  return 0;
}

export function estimateConfidence(odds1, odds2, fallback) {
  if (typeof odds1 === 'number' && typeof odds2 === 'number') {
    const spread = Math.abs(odds1 - odds2);
    const conf = 70 - spread * 10;
    return clamp(Math.round(conf), 30, 90);
  }
  if (fallback?.stats != null && fallback?.odds != null) {
    const conf = fallback.stats * 0.9 + (2.5 - Math.min(2.5, Math.abs(2 - fallback.odds))) * 10;
    return clamp(Math.round(conf), 30, 90);
  }
  return 50;
}

export function generateLabel(ev, conf) {
  if (ev >= 5 && conf >= 65) return 'SAFE';
  if (ev >= 2 && conf >= 55) return 'RISKY';
  if (ev < 0) return 'AVOID';
  return 'STARTS SOON';
}

export function generateNote(label, ev, conf) {
  switch (label) {
    case 'SAFE':  return `Solid edge (${ev.toFixed(1)}% EV, ${conf}% conf).`;
    case 'RISKY': return `Some edge (${ev.toFixed(1)}% EV) but lower confidence (${conf}%).`;
    case 'AVOID': return `Negative EV (${ev.toFixed(1)}%). Skip.`;
    default:      return `Match starting soon. Keep an eye on live odds.`;
  }
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}