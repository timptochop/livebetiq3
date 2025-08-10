// src/utils/aiPredictionEngine.js

// --- helpers ---
function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

// Υπολογισμός "δίκαιων" πιθανοτήτων με κανονικοποίηση overround (margin της αγοράς)
function fairProbsFromOdds(odds1, odds2) {
  const imp1 = 1 / odds1;
  const imp2 = 1 / odds2;
  const overround = imp1 + imp2; // > 1 λόγω margin
  if (!isFinite(overround) || overround <= 0) return { p1: 0.5, p2: 0.5, overround: 1 };

  return {
    p1: imp1 / overround, // fair prob για παίκτη1
    p2: imp2 / overround, // fair prob για παίκτη2
    overround,            // χρήσιμο για confidence penalty
  };
}

// EV (%) του "καλύτερου" side, με βάση τις ίδιες δύο αποδόσεις
// EV_side = (odds * fairProb - 1) * 100
export function calculateEV(odds1, odds2, fallback) {
  // Primary: δύο αποδόσεις
  if (typeof odds1 === 'number' && typeof odds2 === 'number' && odds1 > 1 && odds2 > 1) {
    const { p1, p2 } = fairProbsFromOdds(odds1, odds2);
    const ev1 = (odds1 * p1 - 1) * 100;
    const ev2 = (odds2 * p2 - 1) * 100;
    // πάρε το καλύτερο edge (το πιο θετικό)
    const best = Math.max(ev1, ev2);
    return clamp(Number(best.toFixed(2)), -50, 50);
  }

  // Fallback: probability + odds από το αντικείμενο
  if (fallback?.probability != null && fallback?.odds != null) {
    const ev = (fallback.probability * fallback.odds - 1) * 100;
    return clamp(Number(ev.toFixed(2)), -50, 50);
  }

  return 0;
}

// Confidence: βασίζεται στη "διαφορά" των αποδόσεων (όσο μεγαλύτερη, τόσο πιο ξεκάθαρο φαβορί)
// + penalty/bonus από το overround (χαμηλό overround = καλύτερης ποιότητας τιμές)
// + optional fallback (stats/odds)
export function estimateConfidence(odds1, odds2, fallback) {
  if (typeof odds1 === 'number' && typeof odds2 === 'number' && odds1 > 1 && odds2 > 1) {
    const spread = Math.abs(odds1 - odds2);             // διαφορά αποδόσεων
    const { overround } = fairProbsFromOdds(odds1, odds2);

    // base από spread (0..?) -> χάρτης σε 30..85
    const base = clamp(85 - spread * 12, 30, 85);

    // penalty/bonus από overround (1.02~1.12 typ)
    // όσο πιο κοντά στο 1, τόσο καλύτερα -> +0..+7
    const orPenalty = clamp((1.12 - Math.min(overround, 1.12)) * 70, 0, 7);

    const conf = base + orPenalty;
    return clamp(Math.round(conf), 30, 92);
  }

  if (fallback?.stats != null && fallback?.odds != null) {
    // απλούστερο fallback: στατιστικά + "ποιότητα" από το πόσο κοντά είναι οι αποδόσεις στο 2.00
    const quality = (2.5 - Math.min(2.5, Math.abs(2 - fallback.odds))) * 10; // 0..25 περίπου
    const conf = fallback.stats * 0.8 + quality;
    return clamp(Math.round(conf), 30, 90);
  }

  return 55;
}

// Labeling: απλά, καθαρά thresholds
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