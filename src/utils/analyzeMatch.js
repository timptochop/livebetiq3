// src/utils/analyzeMatch.js
//
// Senior-grade AI core with mid-Set3 gating, momentum, confidence and Kelly level.
// UI ΔΕΝ δείχνει EV/Conf νούμερα· το label + tip είναι compact όπως ζητήθηκε.

const FINISHED = new Set([
  'finished', 'cancelled', 'retired', 'abandoned', 'postponed', 'walk over'
]);
const isFinishedLike = (s) => FINISHED.has(String(s || '').toLowerCase());
const isUpcoming = (s) => String(s || '').toLowerCase() === 'not started';

const num = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function getPlayers(match) {
  const p =
    Array.isArray(match?.players) ? match.players :
    Array.isArray(match?.player)  ? match.player  : [];
  const a = p[0] || {};
  const b = p[1] || {};
  return [
    {
      id: a.id || a['@id'] || '',
      name: a.name || a['@name'] || '',
      s: [num(a.s1), num(a.s2), num(a.s3), num(a.s4), num(a.s5)],
    },
    {
      id: b.id || b['@id'] || '',
      name: b.name || b['@name'] || '',
      s: [num(b.s1), num(b.s2), num(b.s3), num(b.s4), num(b.s5)],
    },
  ];
}

function currentSetFromScores(players) {
  const sA = players[0].s, sB = players[1].s;
  let k = 0;
  for (let i = 0; i < 5; i += 1) {
    if (sA[i] !== null || sB[i] !== null) k = i + 1;
  }
  return k || 0;
}

function totalGamesSoFar(players) {
  const sA = players[0].s, sB = players[1].s;
  let sum = 0;
  for (let i = 0; i < 5; i += 1) {
    sum += (sA[i] || 0) + (sB[i] || 0);
  }
  return sum;
}

function setsWon(players) {
  const sA = players[0].s, sB = players[1].s;
  let a = 0, b = 0;
  for (let i = 0; i < 5; i += 1) {
    const A = sA[i] ?? null, B = sB[i] ?? null;
    if (A === null && B === null) break;
    if (A !== null && B !== null) {
      if (A > B) a += 1;
      else if (B > A) b += 1;
    }
  }
  return { a, b };
}

function momentumScore(players, setNum) {
  // τρέχον σετ έχει βάρος 1.0, προηγούμενο 0.5
  if (setNum <= 0) return 0;
  const sA = players[0].s, sB = players[1].s;
  const i = setNum - 1;

  const cur = ((sA[i] || 0) - (sB[i] || 0));
  const prev = i > 0 ? ((sA[i - 1] || 0) - (sB[i - 1] || 0)) : 0;
  return cur + 0.5 * prev; // range περίπου -∞..+∞ αλλά στην πράξη -6..+6
}

function estimateConfidence(totalGames) {
  // πιο επιθετικό calibration
  if (totalGames >= 30) return 66;
  if (totalGames >= 24) return 62;
  if (totalGames >= 18) return 58;
  return 55;
}

function estimateEV({ momentum, setsLead }) {
  // Base edge + boosts/penalties
  let ev = 0.018; // base
  if (momentum >= 2) ev += 0.008;
  else if (momentum >= 1) ev += 0.004;
  else if (momentum <= -2) ev -= 0.006;
  else if (momentum <= -1) ev -= 0.003;

  if (setsLead > 0) ev += 0.004;
  else if (setsLead < 0) ev -= 0.004;

  // clamp
  if (ev < 0) ev = 0;
  return ev;
}

function kellyLevelFrom(ev, conf) {
  // ΔΕΝ επιστρέφουμε ποσοστά — μόνο επίπεδο για UI bullets
  if (ev >= 0.026 && conf >= 62) return 'HIGH';
  if (ev >= 0.021 && conf >= 58) return 'MED';
  if (ev >= 0.017 && conf >= 55) return 'LOW';
  return null;
}

function labelFrom(ev, conf) {
  if (ev >= 0.026 && conf >= 62) return 'SAFE';
  if (ev >= 0.021 && conf >= 56) return 'RISKY';
  return 'AVOID';
}

export default function analyzeMatch(match) {
  const status = match?.status || match?.['@status'] || '';
  if (!status || isFinishedLike(status)) {
    return { label: null, tip: null, kellyLevel: null };
  }

  const players = getPlayers(match);
  const setNum = currentSetFromScores(players);
  const live = !isUpcoming(status) && !isFinishedLike(status);

  // --- Gating ---
  // Πριν το Set 3 ⇒ δείχνουμε μόνο σετ/soon στο UI (AI δεν βγάζει πρόβλεψη)
  if (!live) {
    return { label: 'SOON', tip: null, kellyLevel: null };
  }
  if (setNum < 3) {
    return { label: `SET ${setNum || 1}`, tip: null, kellyLevel: null };
  }

  // Από ΜΕΣΗ 3ου σετ και μετά θεωρούμε ότι έχουμε αρκετό σήμα:
  const total = totalGamesSoFar(players);
  const { a: setsA, b: setsB } = setsWon(players);
  const setsLead = setsA - setsB;
  const mom = momentumScore(players, setNum);

  const conf = estimateConfidence(total);
  const ev = estimateEV({ momentum: mom, setsLead });
  const label = labelFrom(ev, conf);
  const kellyLevel = kellyLevelFrom(ev, conf);

  // Επιλογή TIP:
  // 1) Αν στο τρέχον σετ προηγείται κάποιος, παίρνουμε αυτόν.
  // 2) αλλιώς, όποιος προηγείται σε κερδισμένα σετ.
  const i = Math.max(0, setNum - 1);
  const gA = players[0].s[i] || 0;
  const gB = players[1].s[i] || 0;
  let pickIdx = 0;
  if (gA > gB) pickIdx = 0;
  else if (gB > gA) pickIdx = 1;
  else {
    if (setsA > setsB) pickIdx = 0;
    else if (setsB > setsA) pickIdx = 1;
    else pickIdx = mom >= 0 ? 0 : 1;
  }

  const tip = players[pickIdx].name || null;

  return {
    label,       // 'SAFE' | 'RISKY' | 'AVOID'
    tip,         // player name only (UI: "TIP: <name>")
    kellyLevel,  // 'HIGH' | 'MED' | 'LOW' | null  (UI bullets)
  };
}