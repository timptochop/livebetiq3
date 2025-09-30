// src/utils/predictor.js
//
// Lightweight live tennis win-probability model (no deps)

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const nz = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// τουρνουά -> μικρό σταθεροποιητικό βάρος
function tourWeight(category = "") {
  const c = String(category).toLowerCase();
  if (c.includes("grand")) return 0.10;
  if (c.includes("atp") || c.includes("wta")) return 0.07;
  if (c.includes("challeng")) return 0.05;
  return 0.03;
}

// odds -> probability (prior)
function probFromOdds(oddsHome, oddsAway) {
  const oh = nz(oddsHome, 0);
  const oa = nz(oddsAway, 0);
  if (oh > 1.01 && oa > 1.01) {
    const ph = 1 / oh, pa = 1 / oa;
    const k = ph + pa;
    return { baseA: ph / k, baseB: pa / k };
  }
  return { baseA: 0.5, baseB: 0.5 };
}

/**
 * Υπολογισμός πιθανότητας νίκης για A (players[0]) και B (players[1])
 */
export function computeWinProb(features) {
  const {
    setsA = 0, setsB = 0,
    gamesA = 0, gamesB = 0,
    setIndex = 1,
    tiebreakA = 0, tiebreakB = 0,
    categoryName = "",
    oddsA, oddsB
  } = features || {};

  const { baseA, baseB } = probFromOdds(oddsA, oddsB);

  const setLead  = clamp(setsA - setsB, -2, 2);
  const gameLead = clamp(gamesA - gamesB, -6, 6);
  const tbActive = (tiebreakA > 0 || tiebreakB > 0) ? 1 : 0;
  const tbLead   = clamp(tiebreakA - tiebreakB, -7, 7);

  // βάρη (calibrated)
  const w0 = 0.00;
  const wSet = 1.35;
  const wGame = 0.32 + 0.05 * (setIndex >= 3 ? 1 : 0);
  const wTB = 0.55;
  const wTour = tourWeight(categoryName);
  const wPrior = 1.10;

  const eps = 1e-9;
  const priorLogit = Math.log(
    Math.max(eps, Math.min(1 - eps, baseA)) /
    Math.max(eps, Math.min(1 - eps, baseB))
  );

  const z =
    w0 +
    wPrior * priorLogit +
    wSet   * setLead +
    wGame  * gameLead +
    wTB    * tbActive * tbLead +
    wTour  * (setIndex - 1);

  const pA = clamp(sigmoid(z), 0.01, 0.99);
  const pB = 1 - pA;
  return { pA, pB };
}

/** πιθανότητα -> label/kelly/tip */
export function labelFromProb(pA, tipNameA, tipNameB) {
  const p = clamp(pA, 0, 1);
  if (p >= 0.78) return { label: "SAFE",  tip: tipNameA, kelly: "HIGH", prob: p };
  if (p >= 0.60) return { label: "RISKY", tip: tipNameA, kelly: "MED",  prob: p };
  if (p <= 0.22) return { label: "SAFE",  tip: tipNameB, kelly: "HIGH", prob: 1 - p };
  if (p <= 0.40) return { label: "RISKY", tip: tipNameB, kelly: "MED",  prob: 1 - p };
  return { label: "PENDING", tip: null, kelly: null, prob: p };
}