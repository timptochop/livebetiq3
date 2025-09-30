// src/utils/analyzeMatch.js
import { getDrift } from "./oddsTracker";

// safe int
const num = (v) => (v === undefined || v === null || v === "" ? 0 :
  parseInt(String(v).split(/[.:]/)[0], 10) || 0);

// Προσπάθεια εξαγωγής implied probability από πιθανά πεδία odds.
// Αν δεν υπάρχουν, επιστρέφει null και θα πέσουμε στο 0.50 baseline.
function impliedProbFromMatch(m = {}) {
  const o = m.odds || m.liveOdds || {};
  const h = Number(o.home ?? o.h ?? o.a1 ?? o.p1);
  const a = Number(o.away ?? o.a ?? o.a2 ?? o.p2);
  const fav = [h, a].filter(x => Number.isFinite(x) && x > 1).sort((x, y) => x - y)[0];
  return fav ? 1 / fav : null;
}

export default function analyzeMatch(m = {}) {
  const players = Array.isArray(m.players) ? m.players
                : Array.isArray(m.player)  ? m.player  : [];
  const a = players[0] || {};
  const b = players[1] || {};

  // Υπολογισμός setNum & set lead
  const setsA = [a.s1, a.s2, a.s3, a.s4, a.s5].map(num);
  const setsB = [b.s1, b.s2, b.s3, b.s4, b.s5].map(num);
  let setNum = 0, wonA = 0, wonB = 0;
  for (let i = 0; i < 5; i++) {
    const sa = setsA[i], sb = setsB[i];
    if (sa || sb) {
      setNum = i + 1;
      if (sa > sb) wonA++; else if (sb > sa) wonB++;
    }
  }

  const status = String(m.status || "").toLowerCase();
  const live = status && status !== "not started";
  const setLead = Math.max(-2, Math.min(2, wonA - wonB)); // -2..2

  // Features
  const pOdds = impliedProbFromMatch(m) ?? 0.50;                  // 0..1
  const momentum = 0.5 + 0.15 * setLead;                          // ~0.2..0.8
  const drift = getDrift(m.id) ?? 0;                              // -0.10..+0.10 τυπικά
  const driftSignal = 0.5 + Math.max(-0.15, Math.min(0.15, -drift)); // προς τα κάτω = υπέρ μας

  const x = [pOdds, momentum, driftSignal, live ? 1 : 0];

  // Σταθερά βάρη (v2 θα γίνει online learning)
  const w = [1.6, 0.9, 1.1, 0.3];
  const b0 = -1.0;

  const z = w[0]*x[0] + w[1]*x[1] + w[2]*x[2] + w[3]*x[3] + b0;
  const conf = 1 / (1 + Math.exp(-z)); // 0..1

  return {
    label: "PENDING",
    conf,
    kellyLevel: conf >= 0.85 ? "HIGH" : conf >= 0.72 ? "MED" : "LOW",
    features: { pOdds, momentum, drift, setNum, live }
  };
}