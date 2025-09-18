// src/utils/analyzeMatch.js
// Senior build: phase-gated AI — ενεργοποιεί SAFE/RISKY μόνο
// από τη ΜΕΣΗ του 3ου σετ και μετά. Πριν από εκεί => SET X / SOON (χειρίζεται το UI).

const FINISHED = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);
const isFinishedLike = s => FINISHED.has(String(s||'').toLowerCase());
const isUpcoming = s => String(s||'').toLowerCase() === 'not started';

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [num(a.s1), num(a.s2), num(a.s3), num(a.s4), num(a.s5)];
  const sB = [num(b.s1), num(b.s2), num(b.s3), num(b.s4), num(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k || 0;
}

function toPlayers(match){
  const players = Array.isArray(match?.players) ? match.players
                : Array.isArray(match?.player)  ? match.player : [];
  const p1 = players[0] || {}, p2 = players[1] || {};
  const name1 = p1.name || p1['@name'] || '';
  const name2 = p2.name || p2['@name'] || '';
  const s = {
    a: [num(p1.s1), num(p1.s2), num(p1.s3), num(p1.s4), num(p1.s5)],
    b: [num(p2.s1), num(p2.s2), num(p2.s3), num(p2.s4), num(p2.s5)],
  };
  return { players, p1, p2, name1, name2, s };
}

function setWins(s){
  // ποιος κέρδισε κάθε ολοκληρωμένο σετ
  let A=0, B=0;
  for (let i=0;i<5;i++){
    const a=s.a[i], b=s.b[i];
    if (a===null || b===null) break;
    if (a>b) A++; else if (b>a) B++;
  }
  return {A,B};
}

function isMidOfSet(a,b){
  // "μέση" σετ ≈ 6+ games παιγμένα (3-3, 4-2, 5-1, ...)
  const A = a ?? 0, B = b ?? 0;
  return (A + B) >= 6;
}

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

export default function analyzeMatch(match){
  try{
    const status = match?.status || match?.['@status'] || '';
    if (!status || isUpcoming(status)) return { label: 'SOON' };
    if (isFinishedLike(status)) return { label: 'DONE' };

    const { name1, name2, s } = toPlayers(match);
    const setNum = currentSetFromScores(match?.players || match?.player);

    // ---- PHASE GATING ----
    // Μέχρι 2ο σετ: ποτέ prediction -> αφήνουμε το UI να δείξει SET X
    if (setNum < 3){
      return { label: `SET ${setNum || 1}` };
    }

    // Στο 3ο σετ, θέλουμε "μέση" του σετ και μετά για ενεργοποίηση AI
    if (setNum === 3 && !isMidOfSet(s.a[2], s.b[2])){
      return { label: 'SET 3' };
    }
    // Σετ 4/5: πάντα ενεργό AI
    // ----------------------

    // --------- Core EV/Confidence proxy (χωρίς odds) ----------
    const idx = Math.max(0, Math.min(4, setNum - 1)); // 0-based index του τρέχοντος σετ
    const currLead = (s.a[idx] ?? 0) - (s.b[idx] ?? 0);

    const {A:setA,B:setB} = setWins(s);
    const setDiff = setA - setB;

    // Βασική πιθανότητα υπέρ του leader, με μικρά weights
    // (ρυθμίσιμα αργότερα με calibration/odds)
    let pA = 0.5 + 0.04*currLead + 0.02*setDiff; // πιθανότητα υπέρ Α
    pA = clamp(pA, 0.05, 0.95);
    const pB = 1 - pA;

    // ποιος είναι το pick
    const pickA = pA >= pB;
    const prob  = pickA ? pA : pB;
    const pick  = pickA ? name1 : name2;

    // Confidence από games-played & lead
    const gamesPlayed = (s.a[idx] ?? 0) + (s.b[idx] ?? 0);
    let confidence = 50 + Math.min(25, gamesPlayed*2 + Math.abs(currLead)*4) + Math.max(-5, setDiff*3);
    confidence = clamp(Math.round(confidence), 50, 92);

    // Label thresholds
    let label = 'AVOID';
    if (prob >= 0.60 && confidence >= 58) label = 'SAFE';
    else if (prob >= 0.53 && confidence >= 52) label = 'RISKY';

    // Kelly "επίπεδο" (χωρίς τιμές) — για κουκίδες στο pill
    let kellyLevel = null; // LOW | MED | HIGH
    if (label === 'SAFE'){
      if (prob >= 0.67) kellyLevel = 'HIGH';
      else if (prob >= 0.62) kellyLevel = 'MED';
      else kellyLevel = 'LOW';
    } else if (label === 'RISKY'){
      kellyLevel = 'LOW';
    }

    return {
      label,
      pick,
      tip: pick,          // TIP = όνομα παίκτη
      confidence,         // (δεν προβάλλεται στο UI, αλλά το κρατάμε)
      ev: null,           // placeholder αν θέλουμε αργότερα odds-aware EV
      kellyLevel,
      meta: { setNum, currLead, setDiff, gamesPlayed }
    };
  }catch(e){
    console.warn('[analyzeMatch] error:', e?.message);
    return { label: 'SOON' };
  }
}