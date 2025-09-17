// src/utils/analyzeMatch.js
// Senior-tuned: Kelly-gate, momentum, set-aware thresholds.
// Signature: analyzeMatch(match, setNum)  ->  { label, pick, confidence, ev, kelly, note }

export default function analyzeMatch(match, setNum = 0) {
  try {
    const { players, player, status } = match || {};
    const P = Array.isArray(players) ? players
            : Array.isArray(player)  ? player  : [];
    const A = P[0] || {};
    const B = P[1] || {};

    // Names (robust against xml2js attrs)
    const nameA = A.name || A['@name'] || match.home || 'Player A';
    const nameB = B.name || B['@name'] || match.away || 'Player B';

    // Set/game scores per set (s1..s5)
    const sA = [
      toNum(A.s1), toNum(A.s2), toNum(A.s3), toNum(A.s4), toNum(A.s5)
    ];
    const sB = [
      toNum(B.s1), toNum(B.s2), toNum(B.s3), toNum(B.s4), toNum(B.s5)
    ];

    // --- Quick live guard ---
    const live = isLive(status);
    // We only produce SAFE/RISKY/AVOID labels with confidence when live or late-upcoming.
    // Otherwise UI θα δείξει SET X ή STARTS SOON (από LiveTennis).
    if (!live && setNum === 0) {
      return { label: null, pick: null, confidence: 0, ev: 0, kelly: 0, note: 'upcoming' };
    }

    // --- Current set index & diff ---
    const cs = clampSet(setNum);
    const curA = sA[cs - 1] ?? null;
    const curB = sB[cs - 1] ?? null;
    const curDiff = diff(curA, curB); // |gamesA - gamesB| στο τρέχον set

    // --- Last completed set winner (momentum) ---
    const lastIx = lastCompletedSetIndex(sA, sB);
    const lastWinner = lastIx >= 0 ? winnerOf(sA[lastIx], sB[lastIx]) : 0; // 1=A, -1=B, 0=tied/none

    // --- Overall leader (tie-breaker for pick) ---
    const setsWonA = setsWon(sA, sB, 5, /*countOnlyCompleted*/ true).a;
    const setsWonB = setsWon(sA, sB, 5, /*countOnlyCompleted*/ true).b;

    // --- Base edge from current-set lead ---
    //   curDiff >=2 → ισχυρό leverage στο Set 3+.
    //   curDiff ==1 → μικρό edge.
    const baseEdge = (() => {
      const wSet = cs >= 3 ? 1.00 : cs === 2 ? 0.65 : 0.45; // βάρος κατά set
      if (curDiff >= 3) return 0.060 * wSet;
      if (curDiff === 2) return 0.040 * wSet;
      if (curDiff === 1) return 0.020 * wSet;
      return 0.000;
    })();

    // --- Momentum boost ---
    // Αν ο νικητής του προηγούμενου set είναι κι αυτός που προηγείται τώρα ⇒ boost.
    // Αντίθετα, μικρό malus (comeback risk).
    let momentum = 0.0;
    const leadingNow = sign((curA ?? 0) - (curB ?? 0)); //  1 αν προηγείται Α, -1 αν Β
    if (lastWinner !== 0 && leadingNow !== 0) {
      if (lastWinner === leadingNow) {
        momentum += cs >= 3 ? 0.020 : 0.010; // μεγαλύτερο boost στο Set3+
      } else {
        momentum -= 0.010; // κόντρα ορμή
      }
    }

    // --- Mini “form” from total games so far (slightly stabilizes confidence) ---
    const totalGames = sumGames(sA, sB);
    const formAdj = totalGames >= 30 ? 0.010
                    : totalGames >= 20 ? 0.006
                    : totalGames >= 12 ? 0.003
                    : 0.000;

    // --- EV proxy (no market odds here): bounded edge 0..~7% ---
    let ev = clamp(baseEdge + momentum + formAdj, 0, 0.07);

    // --- Confidence (0..100) με set-aware κλίση & curDiff ---
    let confidence = 48;
    confidence += cs >= 3 ? 10 : cs === 2 ? 6 : 0;     // αργότερα set ⇒ μεγαλύτερη εμπιστοσύνη
    confidence += curDiff >= 3 ? 12 : curDiff === 2 ? 8 : curDiff === 1 ? 4 : 0;
    confidence += totalGames >= 30 ? 8 : totalGames >= 20 ? 6 : totalGames >= 12 ? 4 : 0;
    confidence = clamp(confidence, 40, 85);

    // --- Pick (ποιος είναι μπροστά) ---
    const leadByGames = sign((curA ?? 0) - (curB ?? 0));
    let pickIdx = 0; // 0=A, 1=B
    if (leadByGames > 0) pickIdx = 0;
    else if (leadByGames < 0) pickIdx = 1;
    else {
      // αν ισοπαλία στο τρέχον set: κοιτάμε σετ
      if (setsWonA !== setsWonB) pickIdx = setsWonA > setsWonB ? 0 : 1;
      else pickIdx = 0; // default
    }
    const pick = pickIdx === 0 ? nameA : nameB;

    // --- Kelly (proxy): Χωρίς odds, προσομοιώνουμε fair odds ~2.00
    // Kelly = f* = (bp - q)/b, με b≈1 (decimal 2.0), p≈0.5 + ev
    const p = clamp(0.50 + ev, 0.50, 0.70);  // προστατευμένο
    const b = 1.0;                            // ισοδύναμο με decimal 2.00
    const q = 1 - p;
    const kelly = clamp((b * p - q) / b, 0, 0.10); // 0..10%

    // --- Gates & Labels (set-aware) ---
    // Στόχος: SAFE μόνο αν Set3+ ΚΑΙ αρκετή εμπιστοσύνη ΚΑΙ Kelly >= 2%.
    // RISKY αν είμαστε κοντά αλλά όχι τόσο ασφαλές.
    // AVOID κατά τα λοιπά.
    let label = 'AVOID';

    const SAFE_REQ = {
      minSet: 3,
      minConf: 60,
      minKelly: 0.02,
      minEv: 0.020
    };
    const RISKY_REQ = {
      minConf: 52,
      minEv: 0.015
    };

    if (cs >= SAFE_REQ.minSet
        && confidence >= SAFE_REQ.minConf
        && kelly >= SAFE_REQ.minKelly
        && ev >= SAFE_REQ.minEv) {
      label = 'SAFE';
    } else if (confidence >= RISKY_REQ.minConf && ev >= RISKY_REQ.minEv) {
      label = 'RISKY';
    } else {
      label = 'AVOID';
    }

    // Αν είμαστε πολύ νωρίς (Set1) → μην “βαφτίζεις” SAFE. Προτίμησε AVOID (ή θα δείξει SET στο UI).
    if (cs <= 1 && label === 'SAFE') label = 'RISKY';

    // Σύντομο note για debug/observability (προαιρετικό)
    const note = [
      `set=${cs}`,
      `curDiff=${curDiff ?? 0}`,
      `setsWon=${setsWonA}-${setsWonB}`,
      `ev=${(ev*100).toFixed(1)}%`,
      `kelly=${(kelly*100).toFixed(1)}%`,
      `conf=${Math.round(confidence)}%`
    ].join(' | ');

    return {
      label,
      pick,
      confidence: Math.round(confidence),
      ev,
      kelly,
      note
    };

  } catch (e) {
    // Ασφαλές fallback
    return { label: null, pick: null, confidence: 0, ev: 0, kelly: 0, note: 'analyzeMatch error' };
  }
}

/* ----------------- helpers ----------------- */
function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
}
function isLive(s) {
  const x = String(s || '').toLowerCase();
  if (!x) return false;
  if (x === 'not started') return false;
  return !['finished','cancelled','retired','abandoned','postponed','walk over'].includes(x);
}
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function sign(x){ return (x>0) ? 1 : (x<0) ? -1 : 0; }
function diff(a,b){
  if (a == null || b == null) return 0;
  return Math.abs((+a||0) - (+b||0));
}
function lastCompletedSetIndex(sA, sB){
  for (let i=4;i>=0;i--){
    const a = sA[i], b = sB[i];
    if (isFiniteNum(a) && isFiniteNum(b) && (a+b) >= 12) return i; // ~ completed set
  }
  return -1;
}
function isFiniteNum(x){ return Number.isFinite(+x); }
function winnerOf(a,b){
  const A = +a||0, B = +b||0;
  if (A===B) return 0;
  return A>B ? 1 : -1;
}
function setsWon(sA, sB, maxSets = 5, completedOnly = true){
  let a=0, b=0;
  for (let i=0;i<maxSets;i++){
    const A = +sA[i]||0, B = +sB[i]||0;
    const games = A+B;
    if (completedOnly && games < 12) continue; // περίπου completed
    if (A===B) continue;
    if (A>B) a++; else b++;
  }
  return { a, b };
}
function sumGames(sA, sB){
  let t=0;
  for (let i=0;i<5;i++){
    t += (+sA[i]||0) + (+sB[i]||0);
  }
  return t;
}
function clampSet(s){
  const n = parseInt(s,10);
  if (!Number.isFinite(n) || n<1) return 1;
  if (n>5) return 5;
  return n;
}