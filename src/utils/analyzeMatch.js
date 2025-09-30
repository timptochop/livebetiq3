// src/utils/analyzeMatch.js
//
// Επιστρέφει: { label, tip, kellyLevel, prob, reason }

import { computeWinProb, labelFromProb } from "./predictor";

const FINISHED = new Set(["finished","cancelled","retired","abandoned","postponed","walk over"]);
const isFinishedLike = (s) => FINISHED.has(String(s || "").toLowerCase());
const isUpcoming = (s) => String(s || "").toLowerCase() === "not started";

const n = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function parsePlayers(m) {
  const p = Array.isArray(m.players) ? m.players : Array.isArray(m.player) ? m.player : [];
  const A = p[0] || {};
  const B = p[1] || {};
  const PA = {
    name: A.name || A["@name"] || "",
    s: [n(A.s1), n(A.s2), n(A.s3), n(A.s4), n(A.s5)],
    tb: n(A.tb) || 0
  };
  const PB = {
    name: B.name || B["@name"] || "",
    s: [n(B.s1), n(B.s2), n(B.s3), n(B.s4), n(B.s5)],
    tb: n(B.tb) || 0
  };
  return { PA, PB };
}

function currentSetIndex(PA, PB) {
  let k = 0;
  for (let i = 0; i < 5; i++) if (PA.s[i] !== null || PB.s[i] !== null) k = i + 1;
  return k || 1;
}

function setsWonBy(PA, PB) {
  let a = 0, b = 0;
  for (let i = 0; i < 5; i++) {
    const sa = PA.s[i], sb = PB.s[i];
    if (sa === null || sb === null) continue;
    const diff = Math.abs(sa - sb);
    const finishedSet =
      (sa >= 6 || sb >= 6) &&
      (diff >= 2 || (sa === 7 && sb === 6) || (sb === 7 && sa === 6));
    if (!finishedSet) continue;
    if (sa > sb) a++; else b++;
  }
  return { a, b };
}

export default function analyzeMatch(m) {
  const status = m?.status || m?.["@status"] || "";
  const categoryName = m?.categoryName || m?.["@category"] || m?.category || "";

  if (isFinishedLike(status)) {
    return { label: "PENDING", tip: null, kellyLevel: null, prob: null, reason: "Finished-like status" };
  }

  const { PA, PB } = parsePlayers(m);
  const setIdx = currentSetIndex(PA, PB);
  const { a: setsA, b: setsB } = setsWonBy(PA, PB);

  const gA = (PA.s[setIdx - 1] ?? 0);
  const gB = (PB.s[setIdx - 1] ?? 0);

  // Προαιρετικά odds αν υπάρχουν στο αντικείμενο
  const oddsA = m?.odds?.home ?? m?.oddsHome ?? null;
  const oddsB = m?.odds?.away ?? m?.oddsAway ?? null;

  const { pA, pB } = computeWinProb({
    setsA, setsB,
    gamesA: gA, gamesB: gB,
    setIndex: setIdx,
    tiebreakA: PA.tb || 0,
    tiebreakB: PB.tb || 0,
    categoryName,
    oddsA, oddsB
  });

  const L = labelFromProb(pA, PA.name, PB.name);

  let label = L.label;
  let tip = L.tip;
  let kellyLevel = L.kelly;
  let prob = Number((L.prob || 0).toFixed(3));
  if (label === "PENDING" && !isUpcoming(status)) {
    label = `SET ${setIdx}`;
    tip = null;
    kellyLevel = null;
    prob = null;
  }

  const reason =
    `sets ${setsA}-${setsB}, games ${gA}-${gB} (set ${setIdx})` +
    (PA.tb || PB.tb ? `, tiebreak ${PA.tb}-${PB.tb}` : "") +
    (oddsA && oddsB ? `, odds ${oddsA}/${oddsB}` : "");

  return { label, tip, kellyLevel, prob, reason };
}