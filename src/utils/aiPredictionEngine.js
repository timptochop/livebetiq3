// src/utils/aiPredictionEngine.js

// --- Tunable weights & thresholds ------------------------------------------
const WEIGHTS = {
  // EV thresholds (%)
  EV_SAFE_MIN: 5,
  EV_RISKY_MIN: 2,

  // Confidence thresholds (%)
  CONF_SAFE_MIN: 65,
  CONF_RISKY_MIN: 55,

  // Limits/Clamps
  CONF_MIN: 30,
  CONF_MAX: 90,
  EV_MIN: -20,
  EV_MAX: 20
};

/** Δώσε τα τρέχοντα weights (για debug/UI στο μέλλον) */
export function getWeights() {
  return { ...WEIGHTS };
}

/** Πέρασε νέα weights on the fly (π.χ. από admin panel στο μέλλον) */
export function setWeights(next = {}) {
  Object.keys(next).forEach((k) => {
    if (k in WEIGHTS && typeof next[k] === 'number') {
      WEIGHTS[k] = next[k];
    }
  });
}

// ---------------------------------------------------------------------------

/**
 * Υπολογισμός EV (%).
 * - Αν έχεις odds1/odds2 -> proxy υπολογισμός γύρω από 50/50
 * - Αλλιώς fallback σε probability * odds
 */
export function calculateEV(odds1, odds2, fallback) {
  if (typeof odds1 === 'number' && typeof odds2 === 'number') {
    const p1 = 1 / odds1;
    const p2 = 1 / odds2;
    const edge = Math.max(p1, p2) - 0.5; // απόκλιση από coin-flip
    const ev = edge * 100;
    return clamp(ev, WEIGHTS.EV_MIN, WEIGHTS.EV_MAX);
  }
  if (fallback?.probability != null && fallback?.odds != null) {
    const ev = (fallback.probability * fallback.odds - 1) * 100;
    return clamp(ev, WEIGHTS.EV_MIN, WEIGHTS.EV_MAX);
  }
  return 0;
}

/**
 * Εκτίμηση confidence (%).
 * - Αν έχουμε odds: όσο μικρότερη διαφορά τόσο υψηλότερο “σίγουρο”
 * - Fallback: χρησιμοποιεί stats/odds
 */
export function estimateConfidence(odds1, odds2, fallback) {
  if (typeof odds1 === 'number' && typeof odds2 === 'number') {
    const spread = Math.abs(odds1 - odds2);
    const conf = 70 - spread * 10;
    return clamp(Math.round(conf), WEIGHTS.CONF_MIN, WEIGHTS.CONF_MAX);
  }
  if (fallback?.stats != null && fallback?.odds != null) {
    const conf = fallback.stats * 0.9 + (2.5 - Math.min(2.5, Math.abs(2 - fallback.odds))) * 10;
    return clamp(Math.round(conf), WEIGHTS.CONF_MIN, WEIGHTS.CONF_MAX);
  }
  return 50;
}

/** Κατάταξη ετικέτας με βάση τα thresholds */
export function generateLabel(ev, conf) {
  if (ev >= WEIGHTS.EV_SAFE_MIN && conf >= WEIGHTS.CONF_SAFE_MIN) return 'SAFE';
  if (ev >= WEIGHTS.EV_RISKY_MIN && conf >= WEIGHTS.CONF_RISKY_MIN) return 'RISKY';
  if (ev < 0) return 'AVOID';
  return 'STARTS SOON';
}

/** Μικρό reasoning μήνυμα */
export function generateNote(label, ev, conf) {
  const e = Number(ev).toFixed(1);
  const c = Math.round(conf);
  switch (label) {
    case 'SAFE':  return `Solid edge (${e}% EV, ${c}% conf).`;
    case 'RISKY': return `Some edge (${e}% EV) but lower confidence (${c}%).`;
    case 'AVOID': return `Negative EV (${e}%). Skip.`;
    default:      return `Match starting soon. Keep an eye on live odds.`;
  }
}

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}