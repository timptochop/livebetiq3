/**
 * pointContext.js (v1.0)
 * Break/Deuce awareness & tiny confidence nudges for predictor v3.5.
 * – Δεν εξαρτάται από άλλα modules.
 */
export default function pointContext(m = {}) {
  const raw = String(m.pointScore || "");
  const [pA, pB] = mapPoints(raw);
  const { gA, gB } = getTotalGames(m);
  const tiebreak = isTieBreak(m, gA, gB);

  const notes = [];
  let suggestConfDelta = 0;     // -0.05 .. +0.05 bounds θα μπουν στο predictor
  let suggestLabelOverride = ""; // "AVOID" σε tie-break

  if (tiebreak) {
    suggestLabelOverride = "AVOID";
    notes.push("tiebreak");
  }

  // Deuce-ish κατάσταση = υψηλή ένταση → μικρή αρνητική μετατόπιση
  const deuceish = (pA === 3 && pB === 3) || pA === 4 || pB === 4;

  // Μικρά nudges με βάση τη διαφορά πόντων
  const diff = pA - pB;
  if (diff >= 2) {
    suggestConfDelta += 0.03;   // υπέρ A
    notes.push("points+");
  } else if (diff <= -2) {
    suggestConfDelta -= 0.03;   // υπέρ B
    notes.push("points-");
  }

  if (deuceish) {
    suggestConfDelta -= 0.02;
    notes.push("deuceish");
  }

  // Πρόχειρη εκτίμηση πίεσης 0..1 (όσο πιο ακραία/κοντά στο deuce τόσο μεγαλύτερη)
  let pressure = 0.4;
  pressure += Math.min(0.6, Math.max(0, Math.abs(diff) / 4));
  if (deuceish) pressure = Math.min(1, pressure + 0.3);

  return {
    pointState: raw,
    suggestConfDelta,
    suggestLabelOverride,
    pressure,
    notes
  };
}

/* ---------- helpers (τοπικά) ---------- */

function mapPoints(raw) {
  const map = { "0":0, "15":1, "30":2, "40":3, "Ad":4, "AD":4, "A":4, "ADV":4 };
  const parts = String(raw || "").split("-");
  if (parts.length !== 2) return [0, 0];
  return [ map[parts[0].trim()] ?? 0, map[parts[1].trim()] ?? 0 ];
}

function getTotalGames(m = {}) {
  const a = (m.players && m.players[0]) || {};
  const b = (m.players && m.players[1]) || {};
  const gA = parseInt(a.games ?? a.g ?? a.currentGame ?? 0, 10) || 0;
  const gB = parseInt(b.games ?? b.g ?? b.currentGame ?? 0, 10) || 0;
  return { gA, gB };
}

function isTieBreak(m = {}, gA, gB) {
  // simple guard: tie-break όταν και οι δύο έχουν >=6 games
  const A = Number.isFinite(gA) ? gA : getTotalGames(m).gA;
  const B = Number.isFinite(gB) ? gB : getTotalGames(m).gB;
  return A >= 6 && B >= 6;
}
