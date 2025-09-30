// src/utils/aiEngineV2.js
import { getDrift } from "./oddsTracker";

/** Safe int */
const inum = (v) => (v === undefined || v === null || v === "" ? 0 :
  parseInt(String(v).split(/[.:]/)[0], 10) || 0);

/** Προσπάθεια εξαγωγής implied prob από διάφορα πιθανά πεδία odds */
export function impliedProbFromMatch(m = {}) {
  const o = m.odds || m.liveOdds || {};
  const h = Number(o.home ?? o.h ?? o.a1 ?? o.p1);
  const a = Number(o.away ?? o.a ?? o.a2 ?? o.p2);
  const fav = [h, a].filter(x => Number.isFinite(x) && x > 1).sort((x, y) => x - y)[0];
  return fav ? 1 / fav : null; // 0..1 (π.χ. 1/1.80 ≈ 0.555)
}

/** Επιστρέφει { pOdds, momentum, driftSignal, setNum, live } */
export function computeFeatures(m = {}) {
  const players = Array.isArray(m.players) ? m.players
                : Array.isArray(m.player)  ? m.player  : [];
  const a = players[0] || {};
  const b = players[1] || {};

  // set counter & lead
  const A = [a.s1, a.s2, a.s3, a.s4, a.s5].map(inum);
  const B = [b.s1, b.s2, b.s3, b.s4, b.s5].map(inum);
  let setNum = 0, wonA = 0, wonB = 0;
  for (let i = 0; i < 5; i++) {
    const sa = A[i], sb = B[i];
    if (sa || sb) {
      setNum = i + 1;
      if (sa > sb) wonA++; else if (sb > sa) wonB++;
    }
  }
  const setLead = Math.max(-2, Math.min(2, wonA - wonB));

  const status = String(m.status || m["@status"] || "").toLowerCase();
  const live = status && status !== "not started";

  const pOdds = impliedProbFromMatch(m) ?? 0.50;                 // 0..1
  const momentum = 0.5 + 0.15 * setLead;                         // ~0.2..0.8
  const drift = getDrift(m.id) ?? 0;                             // -0.10..+0.10 (συνήθως)
  const driftSignal = 0.5 + Math.max(-0.15, Math.min(0.15, -drift)); // πτώση αποδόσεων υπέρ μας

  return { pOdds, momentum, driftSignal, setNum, live, drift };
}

/** Sigmoid */
export const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** Βαθμολογητής -> επιστρέφει conf (0..1) */
export function score(features) {
  const { pOdds, momentum, driftSignal, live } = features;
  // Βάρη σταθερά (θα γίνουν online-learned αργότερα)
  const w = [1.6, 0.9, 1.1, 0.3];  // pOdds, momentum, driftSignal, live
  const b0 = -1.0;
  const x = [pOdds, momentum, driftSignal, live ? 1 : 0];
  const z = w[0]*x[0] + w[1]*x[1] + w[2]*x[2] + w[3]*x[3] + b0;
  return sigmoid(z);
}