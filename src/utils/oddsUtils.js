// src/utils/oddsUtils.js
// Odds helpers + Kelly guards (no UI numbers shown)

export function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 12);
}

export function findOddsForPick(pickName, odds) {
  if (!odds || !pickName) return null;
  const pickKey = normalizeName(pickName);

  // 1) direct object: { "Novak Djokovic": 1.55, "Jannik Sinner": 2.45, ... }
  if (!Array.isArray(odds) && typeof odds === "object") {
    for (const [k, v] of Object.entries(odds)) {
      if (typeof v === "number" && normalizeName(k).includes(pickKey)) return v;
    }
    // common keys fallback
    for (const k of ["home", "away", "player1", "player2", "p1", "p2"]) {
      if (typeof odds[k] === "number") return odds[k];
    }
  }

  // 2) list of markets
  if (Array.isArray(odds)) {
    for (const m of odds) {
      const n1 = m?.homeName || m?.name1 || m?.player1Name;
      const n2 = m?.awayName || m?.name2 || m?.player2Name;
      const v1 = m?.home || m?.player1 || m?.p1;
      const v2 = m?.away || m?.player2 || m?.p2;
      if (n1 && typeof v1 === "number" && normalizeName(n1).includes(pickKey)) return v1;
      if (n2 && typeof v2 === "number" && normalizeName(n2).includes(pickKey)) return v2;
    }
  }
  return null;
}

export function kellyFraction(p, odds) {
  const b = Math.max((odds || 0) - 1, 0);
  if (b <= 0) return -1; // no value
  return (b * p - (1 - p)) / b;
}

export function guardLabelByKelly(baseLabel, p, odds) {
  const f = kellyFraction(p, odds);
  const ev = p * (odds || 0) - 1;

  if (f < 0 || ev <= 0) return { label: "AVOID", kelly: 0, level: null };

  // thresholds (tuned, conservative caps)
  if (f >= 0.02 && ev >= 0.015) {
    const k = Math.min(f, 0.05);
    const level = k >= 0.035 ? "HIGH" : (k >= 0.02 ? "MED" : "LOW");
    return { label: "SAFE", kelly: k, level };
  }
  if (f >= 0.01 && ev >= 0.005) {
    const k = Math.min(f, 0.03);
    const level = k >= 0.02 ? "MED" : "LOW";
    return { label: "RISKY", kelly: k, level };
  }

  return { label: "AVOID", kelly: 0, level: null };
}