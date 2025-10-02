// src/utils/predictor.js
// Στόχος: σταθερή, ντετερμινιστική πρόβλεψη με βασικά heuristics ανά σετ.
// Δεν αγγίζουμε odds. Χρησιμοποιούμε μόνο το feed (status + s1..s5).

const FINISHED = new Set([
  'finished', 'cancelled', 'retired', 'abandoned', 'postponed', 'walk over'
]);

export function isFinishedLike(status) {
  const s = String(status || '').toLowerCase();
  return FINISHED.has(s);
}

export function isUpcoming(status) {
  return String(status || '').toLowerCase() === 'not started';
}

function toInt(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  // goalserve μπορεί να στείλει "6:3" ή "6.3" ή "6"
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
}

export function currentSetFromScores(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const sA = [toInt(a.s1), toInt(a.s2), toInt(a.s3), toInt(a.s4), toInt(a.s5)];
  const sB = [toInt(b.s1), toInt(b.s2), toInt(b.s3), toInt(b.s4), toInt(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k || 0;
}

function setsArray(players) {
  const p = Array.isArray(players) ? players : [];
  const a = p[0] || {}, b = p[1] || {};
  const Pa = [toInt(a.s1), toInt(a.s2), toInt(a.s3), toInt(a.s4), toInt(a.s5)];
  const Pb = [toInt(b.s1), toInt(b.s2), toInt(b.s3), toInt(b.s4), toInt(b.s5)];
  const out = [];
  for (let i = 0; i < 5; i++) {
    if (Pa[i] === null && Pb[i] === null) continue;
    out.push({ a: Pa[i], b: Pb[i] });
  }
  return out;
}

function setsWon(players) {
  let w1 = 0, w2 = 0;
  for (const s of setsArray(players)) {
    if (s.a == null || s.b == null) continue;
    if (s.a > s.b) w1++;
    else if (s.b > s.a) w2++;
  }
  return [w1, w2];
}

function hasBlowoutForLeader(players) {
  // Έστω set όπου ο νικητής κέρδισε με διαφορά >=3 games (π.χ. 6-3, 6-2, 6-0)
  for (const s of setsArray(players)) {
    if (s.a == null || s.b == null) continue;
    const diff = Math.abs(s.a - s.b);
    if (diff >= 3) return true;
  }
  return false;
}

function namesFrom(m) {
  const players = Array.isArray(m.players) ? m.players
                : Array.isArray(m.player)  ? m.player : [];
  const p1 = players[0] || {}, p2 = players[1] || {};
  return [
    p1.name || p1['@name'] || '',
    p2.name || p2['@name'] || ''
  ];
}

// ----- public: κύρια πρόβλεψη -----
export function predictMatch(m = {}) {
  const status = m.status || m['@status'] || '';
  const players = Array.isArray(m.players) ? m.players
                : Array.isArray(m.player)  ? m.player : [];
  const setNum = currentSetFromScores(players);
  const [w1, w2] = setsWon(players);
  const [name1, name2] = namesFrom(m);

  // 0) terminal states
  if (isFinishedLike(status)) {
    return { label: 'AVOID', conf: 0.99, tip: null, features: { setNum, w1, w2, status } };
  }
  if (isUpcoming(status)) {
    return { label: 'SOON', conf: 0.50, tip: null, features: { setNum, w1, w2, status } };
  }

  // 1) live
  const setDiff = w1 - w2;
  const absSetDiff = Math.abs(setDiff);
  const leader = setDiff > 0 ? 1 : (setDiff < 0 ? 2 : 0);

  // βασικοί κανόνες ανά set:
  // set 1: μικρή πληροφορία -> RISKY
  // set 2: αν υπάρχει leader στα sets & έχει υπάρξει blowout, SAFE στον leader, αλλιώς RISKY
  // set >=3: leader στα sets -> SAFE; ισοπαλία -> RISKY
  let label = 'RISKY';
  let conf = 0.70;
  let tip = null;

  if (setNum <= 1) {
    label = 'RISKY';
    conf = 0.66;
  } else if (setNum === 2) {
    if (absSetDiff >= 1) {
      if (hasBlowoutForLeader(players)) {
        label = 'SAFE';
        conf = 0.86;
      } else {
        label = 'RISKY';
        conf = 0.74;
      }
      tip = `${leader === 1 ? name1 : name2} to win match`;
    } else {
      label = 'RISKY';
      conf = 0.72;
    }
  } else {
    // set 3+
    if (absSetDiff >= 1) {
      label = 'SAFE';
      conf = 0.88;
      tip = `${leader === 1 ? name1 : name2} to win match`;
    } else {
      label = 'RISKY';
      conf = 0.76;
    }
  }

  return {
    label,
    conf,
    tip,
    features: {
      setNum, w1, w2, status
    }
  };
}