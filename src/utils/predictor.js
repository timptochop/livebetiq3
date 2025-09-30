// src/utils/predictor.js
// Heuristic live model v2: robust σε ελλιπή data, χωρίς εξαρτήσεις.
// Βγάζει: prob (για παίκτη1), label, kellyLevel, tip.

function safeNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
}

function setsWon(player) {
  const s = [safeNum(player?.s1), safeNum(player?.s2), safeNum(player?.s3), safeNum(player?.s4), safeNum(player?.s5)];
  let w = 0;
  for (let i = 0; i < 5; i++) {
    const a = s[i];
    const b = safeNum(player?.op?.[`s${i+1}`]);
    if (a == null && b == null) continue;
    if (a != null && b != null && a > b) w++;
  }
  return w;
}

function currentSet(players) {
  const a = players?.[0] || {};
  const b = players?.[1] || {};
  const sA = [safeNum(a.s1), safeNum(a.s2), safeNum(a.s3), safeNum(a.s4), safeNum(a.s5)];
  const sB = [safeNum(b.s1), safeNum(b.s2), safeNum(b.s3), safeNum(b.s4), safeNum(b.s5)];
  let k = 0;
  for (let i = 0; i < 5; i++) if (sA[i] !== null || sB[i] !== null) k = i + 1;
  return k || 1;
}

function lastSetMargin(players) {
  const k = currentSet(players) - 1;
  if (k <= 0) return 0;
  const a = players?.[0]?.[`s${k}`];
  const b = players?.[1]?.[`s${k}`];
  const A = safeNum(a), B = safeNum(b);
  if (A == null || B == null) return 0;
  const diff = A - B;
  if (!Number.isFinite(diff)) return 0;
  return Math.max(-3, Math.min(3, diff));
}

function logistic(x) {
  // bounded 0..1
  return 1 / (1 + Math.exp(-x));
}

function kellyLevel(p) {
  if (p >= 0.74) return 'HIGH';
  if (p >= 0.62) return 'MED';
  if (p >= 0.56) return 'LOW';
  return null;
}

export default function predict(match) {
  // Προετοιμασία παικτών
  const players = Array.isArray(match?.players) ? match.players
                 : Array.isArray(match?.player)  ? match.player : [];
  const p1 = players[0] || {};
  const p2 = players[1] || {};
  // cross-op refs για υπολογισμό σετ
  p1.op = p2; p2.op = p1;

  const name1 = p1.name || p1['@name'] || 'Player 1';
  const name2 = p2.name || p2['@name'] || 'Player 2';
  const status = (match?.status || match?.['@status'] || '').toLowerCase();

  // Αν δεν έχει ξεκινήσει
  if (status === 'not started') {
    return {
      prob: 0.5,
      label: 'SOON',
      tip: null,
      kellyLevel: null,
      confidence: 0.50,
      winner: null,
    };
  }

  // Βασικά features
  const setIdx = currentSet(players);            // 1..5
  const w1 = setsWon(p1);
  const w2 = setsWon(p2);
  const setLead = w1 - w2;                       // +1 σημαίνει p1 προηγείται στα σετ
  const margin = lastSetMargin(players);         // -3..+3
  const category = String(match?.categoryName || match?.['@category'] || match?.category || '').toLowerCase();

  // Βασικό score από features
  // Start baseline 0.0 -> logistic => 0.5
  let score = 0;

  // Σετ προβάδισμα
  score += 0.9 * setLead;              // ~+0.9 για +1 σετ

  // Τρέχον σετ/φάση (όσο πιο αργά τόσο μεγαλύτερη βαρύτητα)
  score += 0.15 * (setIdx - 1);

  // Ροπή τελευταίου σετ
  score += 0.12 * (margin / 3);        // -0.12 .. +0.12

  // Κατηγορία (WTA τείνει σε μεγαλύτερες ανατροπές => μετριάζουμε)
  if (category.includes('wta') || category.includes('women')) {
    score *= 0.9;
  }

  // Μικρή τυχαιότητα για αποφυγή ισοπαλιών (σταθερή από id ώστε να είναι αναπαραγώγιμη)
  const seed = String(match?.id || `${name1}-${name2}`).split('').reduce((a,c)=>((a<<5)-a + c.charCodeAt(0))|0, 0);
  const jitter = ((seed % 100) / 100 - 0.5) * 0.05; // [-0.025, +0.025]
  score += jitter;

  // Μετατροπή σε πιθανότητα (για p1)
  const prob1 = logistic(score);

  // Απόφαση/labels
  let label;
  if (prob1 >= 0.74) label = 'SAFE';
  else if (prob1 >= 0.58) label = 'RISKY';
  else if (prob1 <= 0.42) label = 'AVOID';
  else label = `SET ${setIdx || 1}`;

  const winner = prob1 >= 0.50 ? name1 : name2;
  const tip = prob1 >= 0.50 ? name1 : name2;

  return {
    prob: Number(prob1.toFixed(3)),
    label,
    tip,
    kellyLevel: kellyLevel(prob1),
    confidence: Number(Math.max(0.5, Math.abs(prob1 - 0.5) * 2).toFixed(3)), // 0.5..1.0
    winner,
  };
}