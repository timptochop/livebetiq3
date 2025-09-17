// src/utils/analyzeMatch.js
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

  // ----------- Simple EV/Confidence Heuristic -----------
  // Παίρνουμε games του τελευταίου σετ που έχει ξεκινήσει
  const score = extractSets(match);
  const last = score.at(-1);
  const gameDiff = last ? Math.abs(last.a - last.b) : 0;

  // EV: λίγο υψηλότερο όταν το τελευταίο σετ έχει μικρή διαφορά (value στο momentum)
  let ev = 0.02;
  if (gameDiff === 0) ev = 0.028;
  else if (gameDiff === 1) ev = 0.024;
  else if (gameDiff >= 2) ev = 0.02;

  // Confidence: αυξάνει όσο περισσότερα games έχουν παιχτεί συνολικά
  const totalGames = score.reduce((s, x) => s + x.a + x.b, 0);
  let confidence = 52;
  if (totalGames > 12) confidence = 57;
  if (totalGames > 20) confidence = 61;
  if (totalGames > 30) confidence = 68;

  // Kelly (διακοσμητικό εδώ – χωρίς odds, βάζουμε proxy)
  const kelly = Math.max(0, Math.min(0.15, (ev - 0.02) * 5)); // 0%–15%

  // Label thresholds
  let label = 'AVOID';
  if (ev > 0.025 && confidence > 55) label = 'SAFE';
  else if (ev > 0.02 && confidence >= 50) label = 'RISKY';

  // Pick (απλό placeholder: όποιος κέρδισε το προηγούμενο σετ)
  let pick = null;
  if (last) {
    if (last.a > last.b) pick = getPlayerName(match, 0);
    else if (last.b > last.a) pick = getPlayerName(match, 1);
  }

  return {
    label,
    pick,
    reason: `ev=${(ev*100).toFixed(1)}% conf=${confidence}%`,
    ev, confidence, kelly,
  };
}

// ---------- helpers ----------
function extractSets(match) {
  const players = Array.isArray(match.players) ? match.players
                : Array.isArray(match.player)  ? match.player  : [];
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

function getPlayerName(match, idx) {
  const players = Array.isArray(match.players) ? match.players
                : Array.isArray(match.player)  ? match.player  : [];
  const p = players[idx] || {};
  return p.name || p['@name'] || '';
}