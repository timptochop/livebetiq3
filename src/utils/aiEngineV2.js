// src/utils/aiEngineV2.js
//
// Pluggable AI scoring: feature extraction -> weighted score -> calibration -> outputs

// 1) Ρυθμίσεις βαρών (εύκολα ρυθμιζόμενα)
const WEIGHTS = {
  // odds features
  favImplied      : 0.90,   // πόσο «δίκαιη» είναι η τιμή του φαβορί
  priceSpread     : -0.60,  // penalty όσο πιο κοντά οι τιμές
  plusMoneyEdge   : 0.45,   // μικρό bonus όταν το underdog έχει λογική

  // basic stats (προέρχονται από mock ή αργότερα από API)
  form            : 0.35,   // πρόσφατη φόρμα 0..100
  momentum        : 0.30,   // live momentum 0..100
  h2h             : 0.25,   // head-to-head υπέρ παίκτη 0..100
  surfaceFit      : 0.20,   // καταλληλότητα επιφάνειας 0..100
  fatiguePenalty  : -0.40,  // penalty κούρασης 0..100

  // bias catch-all
  volatility      : -0.25,  // υψηλή μεταβλητότητα μειώνει σιγουριά
};

// 2) Calibration tables: μετατρέπουμε raw score -> confidence/EV
function calibrateConfidence(raw) {
  // raw περίπου -3..+3 (μετά από z-like scaling)
  // Το φέρνουμε σε 30..90 για πιο «ανθρώπινη» κλίμακα
  const x = Math.max(-3, Math.min(3, raw));
  const pct = 60 / 6 * (x + 3) + 30; // linear map [-3,3] -> [30,90]
  return Math.round(pct);
}

function calibrateEV(raw) {
  // EV % περίπου: μικρή κλίμακα, για να αποφεύγουμε υπερβολές
  // map [-3,3] -> [-10, +15]
  const x = Math.max(-3, Math.min(3, raw));
  const ev = (25 / 6) * x + 2.5; // center ~2.5 ώστε να «κυλάει» σε live
  return Math.round(ev * 10) / 10; // 1 δεκαδικό
}

// 3) Feature extraction (ασφαλές σε ελλιπή δεδομένα)
function featuresFromMatch(m) {
  const odds1 = Number(m.odds1 ?? m.odds ?? 0);
  const odds2 = Number(m.odds2 ?? 0);

  // implied probs
  const imp1 = odds1 > 0 ? 1 / odds1 : 0;
  const imp2 = odds2 > 0 ? 1 / odds2 : 0;
  const favImplied = Math.max(imp1, imp2); // 0..1

  const priceSpread = Math.abs(odds1 - odds2); // όσο μικρότερο, τόσο πιο coinflip
  const plusMoneyEdge =
    (odds1 >= 2.3 || odds2 >= 2.3) ? 1 : 0; // μικρό σήμα για underdog spots

  // optional fields με defaults
  const form       = clamp01((m.form ?? m.stats ?? 60) / 100);
  const momentum   = clamp01((m.momentum ?? 50) / 100);
  const h2h        = clamp01((m.h2h ?? 50) / 100);
  const surfaceFit = clamp01((m.surfaceFit ?? 50) / 100);
  const fatigue    = clamp01((m.fatigue ?? 30) / 100);
  const volatility = clamp01((m.volatility ?? 40) / 100);

  return {
    favImplied,
    priceSpread,
    plusMoneyEdge,
    form,
    momentum,
    h2h,
    surfaceFit,
    fatigue,
    volatility,
  };
}

// 4) Raw score
function score(feat) {
  // scale & combine
  const s =
    WEIGHTS.favImplied    * norm(feat.favImplied, 0, 1) +
    WEIGHTS.priceSpread   * norm(feat.priceSpread, 0, 1.5) +   // typical spread 0..1.5
    WEIGHTS.plusMoneyEdge * feat.plusMoneyEdge +
    WEIGHTS.form          * feat.form +
    WEIGHTS.momentum      * feat.momentum +
    WEIGHTS.h2h           * feat.h2h +
    WEIGHTS.surfaceFit    * feat.surfaceFit +
    WEIGHTS.fatiguePenalty* feat.fatigue +
    WEIGHTS.volatility    * feat.volatility;

  // συμπίεση σε περίπου -3..+3
  return Math.max(-3, Math.min(3, s * 3.2));
}

// 5) Label rules (σταθερές, μπορούν να ρυθμιστούν)
function labelFrom(ev, conf) {
  if (ev >= 8 && conf >= 72) return 'SAFE';
  if (ev >= 4 && conf >= 58) return 'RISKY';
  if (ev < 0) return 'AVOID';
  return 'STARTS SOON';
}

function noteFrom(label, ev, conf) {
  switch (label) {
    case 'SAFE':  return `Solid edge (${ev.toFixed(1)}% EV, ${conf}% conf).`;
    case 'RISKY': return `Some edge (${ev.toFixed(1)}% EV) but lower confidence (${conf}%).`;
    case 'AVOID': return `Negative EV (${ev.toFixed(1)}%). Skip.`;
    default:      return `Match starting soon. Keep an eye on live odds.`;
  }
}

// 6) Δημόσιμες συναρτήσεις (drop-in replacement του παλιού engine)
export function calculateEV(odds1, odds2, m = {}) {
  const f = featuresFromMatch({ ...m, odds1, odds2 });
  const raw = score(f);
  return calibrateEV(raw);
}

export function estimateConfidence(odds1, odds2, m = {}) {
  const f = featuresFromMatch({ ...m, odds1, odds2 });
  const raw = score(f);
  return calibrateConfidence(raw);
}

export function generateLabel(ev, conf) {
  return labelFrom(Number(ev) || 0, Number(conf) || 0);
}

export function generateNote(label, ev, conf) {
  return noteFrom(label, Number(ev) || 0, Number(conf) || 0);
}

// utils
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function norm(x, lo, hi) {
  if (hi === lo) return 0;
  const t = (x - lo) / (hi - lo);
  return Math.max(0, Math.min(1, t));
}