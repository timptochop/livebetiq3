// src/utils/analyzeMatch.js
// AI ενεργό από Set 3+ και ΠΑΝΤΑ δίνει pick για SAFE/RISKY

export default function analyzeMatch(match, setNum) {
  // --- guard: πριν το 3ο σετ δεν δίνουμε AI label ---
  if (!Number.isFinite(setNum) || setNum < 3) {
    return {
      label: null,          // => UI θα δείξει SET X / STARTS SOON
      pick: null,
      reason: 'ai_waiting_set3',
      ev: null,
      confidence: null,
      kelly: null,
    };
  }

  const sets = extractSets(match); // [{a,b},...]
  const last = sets.at(-1) || { a: 0, b: 0 };
  const { nameA, nameB } = getPlayerNames(match);

  // ----------- EV / Confidence -----------
  const gameDiff = Math.abs(last.a - last.b);
  let ev = 0.02;
  if (gameDiff === 0) ev = 0.028;
  else if (gameDiff === 1) ev = 0.024;
  else if (gameDiff >= 2) ev = 0.02;

  const totalGames = sets.reduce((s, x) => s + (x.a || 0) + (x.b || 0), 0);
  let confidence = 52;
  if (totalGames > 12) confidence = 57;
  if (totalGames > 20) confidence = 61;
  if (totalGames > 30) confidence = 68;

  // Kelly (proxy χωρίς odds)
  const kelly = Math.max(0, Math.min(0.15, (ev - 0.02) * 5)); // 0%–15%

  // Label thresholds
  let label = 'AVOID';
  if (ev > 0.025 && confidence > 55) label = 'SAFE';
  else if (ev > 0.02 && confidence >= 50) label = 'RISKY';

  // ----------- TIP (pick) — ΠΑΝΤΑ για SAFE/RISKY -----------
  let pick = decidePick(match, sets, { nameA, nameB });

  // Αν για κάποιο λόγο δεν βγήκε, βγάλε deterministic fallback (ποτέ null σε SAFE/RISKY)
  if ((label === 'SAFE' || label === 'RISKY') && !pick) {
    pick = nameA || nameB || null;
  }

  return {
    label,
    pick,
    reason: `ev=${(ev * 100).toFixed(1)}% · conf=${confidence}%`,
    ev,
    confidence,
    kelly,
  };
}

// ---------- helpers ----------
function extractSets(match) {
  const players = Array.isArray(match.players)
    ? match.players
    : Array.isArray(match.player)
    ? match.player
    : [];
  const a = players[0] || {};
  const b = players[1] || {};

  const sA = [a.s1, a.s2, a.s3, a.s4, a.s5].map(toNum);
  const sB = [b.s1, b.s2, b.s3, b.s4, b.s5].map(toNum);

  const out = [];
  for (let i = 0; i < 5; i++) {
    if (sA[i] !== null || sB[i] !== null) out.push({ a: sA[i] || 0, b: sB[i] || 0 });
  }
  return out;
}

function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
}

function getPlayerNames(match) {
  const players = Array.isArray(match.players)
    ? match.players
    : Array.isArray(match.player)
    ? match.player
    : [];
  const pA = players[0] || {};
  const pB = players[1] || {};
  return {
    nameA: pA.name || pA['@name'] || '',
    nameB: pB.name || pB['@name'] || '',
  };
}

function decidePick(match, sets, { nameA, nameB }) {
  if (!sets || !sets.length) return null;
  const last = sets.at(-1) || { a: 0, b: 0 };

  // 1) Νικητής τελευταίου σετ
  if (last.a > last.b) return nameA;
  if (last.b > last.a) return nameB;

  // 2) Σύνολο σετ κερδισμένα
  let setsA = 0,
    setsB = 0;
  for (const s of sets) {
    if (s.a > s.b) setsA++;
    else if (s.b > s.a) setsB++;
  }
  if (setsA > setsB) return nameA;
  if (setsB > setsA) return nameB;

  // 3) Ποιος προηγείται στο "τρέχον" (τελευταίο) σετ σε games
  const currDiff = last.a - last.b;
  if (currDiff > 0) return nameA;
  if (currDiff < 0) return nameB;

  // 4) Σύνολο games σε όλους τους σετ
  const totalA = sets.reduce((s, x) => s + (x.a || 0), 0);
  const totalB = sets.reduce((s, x) => s + (x.b || 0), 0);
  if (totalA > totalB) return nameA;
  if (totalB > totalA) return nameB;

  // 5) Τίποτα ξεκάθαρο → null (και θα καλυφθεί από deterministic fallback πάνω)
  return null;
}