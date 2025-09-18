// src/utils/analyzeMatch.js
//
// Self-contained έκδοση με mid-set-3 gating, momentum boost και Kelly indicator.
// Δεν απαιτεί άλλα modules.

function num(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
}

function isUpcoming(status) {
  return String(status || '').toLowerCase() === 'not started';
}
function isFinishedLike(status) {
  const x = String(status || '').toLowerCase();
  return ['finished','cancelled','retired','abandoned','postponed','walk over'].includes(x);
}

function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [num(a.s1), num(a.s2), num(a.s3), num(a.s4), num(a.s5)];
  const sB = [num(b.s1), num(b.s2), num(b.s3), num(b.s4), num(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k || 0;
}

function extractSetArray(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [num(a.s1)||0, num(a.s2)||0, num(a.s3)||0, num(a.s4)||0, num(a.s5)||0];
  const sB = [num(b.s1)||0, num(b.s2)||0, num(b.s3)||0, num(b.s4)||0, num(b.s5)||0];
  return { sA, sB };
}

function lastFinishedSetWinner(sA, sB, curIdx) {
  // επιστρέφει 'p1' ή 'p2' ή null για τον τελευταίο *πλήρη* σετ πριν το τρέχον
  for (let i = curIdx - 2; i >= 0; i--) {
    const a = sA[i], b = sB[i];
    if ((a + b) >= 6) {
      if (a > b) return 'p1';
      if (b > a) return 'p2';
    }
  }
  return null;
}

function estimateEV(setNum, sA, sB) {
  // EV proxy: βασισμένο στη διαφορά games του τρέχοντος σετ + συνολική φόρμα
  const i = setNum - 1;
  const curA = sA[i] || 0;
  const curB = sB[i] || 0;
  const curDiff = Math.abs(curA - curB); // 0..6
  const finishedSets = Math.max(0, setNum - 1);
  let baseEV = 0.018 + 0.0015 * finishedSets;     // λίγο ανεβαίνει σε μεταγενέστερα sets
  baseEV += 0.002 * curDiff;                       // momentum εντός set
  // clamp
  if (baseEV < 0.012) baseEV = 0.012;
  if (baseEV > 0.035) baseEV = 0.035;
  return baseEV; // % επί decimal (0.02 = 2%)
}

function estimateConfidence(setNum, sA, sB, lastSetWinner) {
  // Confidence baseline: ανεβαίνει με τα σετ + μικρό boost από momentum/last win
  let c = 52 + (setNum >= 3 ? 6 : setNum === 2 ? 3 : 0); // 52→58 σε set3+
  const i = setNum - 1;
  const curA = sA[i] || 0;
  const curB = sB[i] || 0;
  const curDiff = Math.abs(curA - curB);
  c += Math.min(6, curDiff * 1.5); // έως +6
  if (lastSetWinner === 'p1' || lastSetWinner === 'p2') c += 2; // μικρό boost
  // clamp
  if (c < 50) c = 50;
  if (c > 72) c = 72;
  return Math.round(c);
}

function kellyIndicator(ev, confidence) {
  // Δεν δείχνουμε νούμερο — μόνο qualitative level
  // Θεωρούμε p ~ confidence/100, edge ~ ev
  const score = ev * (confidence / 100); // 0.012..0.035 * 0.5..0.72 ≈ 0.006..0.025
  if (score > 0.020) return 'HIGH';
  if (score > 0.013) return 'MED';
  return 'LOW';
}

function pickSide(players, setNum) {
  // Επιλογή TIP: ποιος προηγείται στο τρέχον σετ, αλλιώς συνολικά games
  const names = [
    (players?.[0]?.name || players?.[0]?.['@name'] || '').trim(),
    (players?.[1]?.name || players?.[1]?.['@name'] || '').trim(),
  ];
  const { sA, sB } = extractSetArray(players);
  const i = setNum - 1;
  if (i >= 0) {
    if (sA[i] > sB[i]) return names[0];
    if (sB[i] > sA[i]) return names[1];
  }
  const totalA = sA.reduce((a, b) => a + b, 0);
  const totalB = sB.reduce((a, b) => a + b, 0);
  if (totalA > totalB) return names[0];
  if (totalB > totalA) return names[1];
  return names[0] || names[1] || null;
}

function makeLabel(ev, confidence) {
  if (ev > 0.026 && confidence >= 58) return 'SAFE';
  if (ev > 0.020 && confidence >= 52) return 'RISKY';
  return 'AVOID';
}

export default function analyzeMatch(match) {
  try {
    const status = match?.status || match?.['@status'] || '';
    const players = Array.isArray(match?.players) ? match.players
                   : Array.isArray(match?.player)  ? match.player : [];
    const live = !!status && !isUpcoming(status) && !isFinishedLike(status);
    const setNum = currentSetFromScores(players);
    const { sA, sB } = extractSetArray(players);

    // --- Gating: AI υπολογισμοί ΜΟΝΟ από mid-Set-3 και μετά ---
    if (!live) {
      return {
        label: isUpcoming(status) ? 'SOON' : 'AVOID',
        kellyLevel: null,
        tip: null,
        reason: 'not_live',
      };
    }
    if (setNum < 3) {
      return {
        label: `SET ${setNum || 1}`,
        kellyLevel: null,
        tip: null,
        reason: 'pre-midset3',
      };
    }
    const i = setNum - 1;
    const curGames = (sA[i] || 0) + (sB[i] || 0); // mid-set ≈ 6+ games total
    if (curGames < 6) {
      return {
        label: `SET ${setNum}`,
        kellyLevel: null,
        tip: null,
        reason: 'early_set3',
      };
    }

    // --- Momentum & EV/Confidence ---
    const lastWinner = lastFinishedSetWinner(sA, sB, setNum);
    let ev = estimateEV(setNum, sA, sB);
    let conf = estimateConfidence(setNum, sA, sB, lastWinner);

    // Momentum small boost αν υπάρχει καθαρό προβάδισμα στο τρέχον σετ
    const curA = sA[i] || 0;
    const curB = sB[i] || 0;
    const diff = Math.abs(curA - curB);
    if (diff >= 2) {
      ev += 0.002;   // +0.2%
      conf += 2;
    }

    if (ev > 0.035) ev = 0.035;
    if (conf > 75) conf = 75;

    const label = makeLabel(ev, conf);
    const tip = pickSide(players, setNum);
    const kellyLevel = kellyIndicator(ev, conf);

    return {
      label,          // SAFE | RISKY | AVOID
      tip,            // μόνο όνομα παίκτη
      kellyLevel,     // LOW | MED | HIGH (μόνο για UI ένδειξη)
      ev,             // (κρατάμε για εσωτερικό use — ΔΕΝ εμφανίζουμε)
      confidence: conf,
      reason: 'midset3+',
    };
  } catch (e) {
    return { label: 'AVOID', kellyLevel: null, tip: null, reason: 'analyze_error' };
  }
}