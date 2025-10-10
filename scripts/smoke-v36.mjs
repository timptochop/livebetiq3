// scripts/smoke-v36.mjs
// Έλεγχος ότι ΟΠΟΙΟ "SAFE" εμφανιστεί τηρεί: Set 2, games 3–6, favOdds >=1.50, fav leading, diff<=2

import analyzeMatch from '../src/utils/analyzeMatch.js';

function rnd(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Βοηθός κατασκευής "ζωντανού" match
function makeMatch({ setNum = 2, ga = 2, gb = 2, oddsFav = 1.6, oddsDog = 2.4, cat = 'ATP 250' }) {
  // Ορίζουμε το φαβορί ως Player A όταν oddsFav < oddsDog
  const pAodds = oddsFav;
  const pBodds = oddsDog;

  return {
    status: `Set ${setNum}`,
    categoryName: cat,
    // players: βάζουμε games στο αντίστοιχο set
    players: [
      { name: 'Player A', s1: 0, s2: setNum === 2 ? ga : 0, s3: 0, s4: 0, s5: 0 },
      { name: 'Player B', s1: 0, s2: setNum === 2 ? gb : 0, s3: 0, s4: 0, s5: 0 }
    ],
    // odds: απλό αντικείμενο με p1/p2
    odds: { p1: pAodds, p2: pBodds },
    date: '01.01.2099',
    time: '10:00'
  };
}

// Ελέγχοι που περιμένουμε να περνάνε πάντα
function expectLabel(match, want) {
  const r = analyzeMatch(match);
  if (r.label !== want) {
    console.error('❌ EXPECT', want, 'GOT', r.label, '->', JSON.stringify({ ga: match.players[0].s2, gb: match.players[1].s2, odds: match.odds }));
    process.exit(1);
  }
}

// 1) Γρήγοροι deterministic έλεγχοι παραθύρου Set 2
console.log('• Guards check...');
expectLabel(makeMatch({ setNum: 1 }), 'SET 1');
expectLabel(makeMatch({ setNum: 3 }), 'SET 3');
expectLabel(makeMatch({ setNum: 2, ga: 1, gb: 1 }), 'SET 2');     // total<3
expectLabel(makeMatch({ setNum: 2, ga: 6, gb: 6 }), 'AVOID');     // tie-break
expectLabel(makeMatch({ setNum: 2, ga: 4, gb: 3 }), 'AVOID');     // μέσα στο παράθυρο αλλά δεν εγγυάται SAFE

console.log('  OK ✓ guards hold.');

// 2) Randomized fuzz: Αν βγει ποτέ SAFE, να τηρεί τα 5 κριτήρια
console.log('• Fuzz check (random scenarios)...');

const violations = [];
let safeCount = 0;

for (let i = 0; i < 250; i++) {
  const setNum = [1,2,2,2,3][rnd(0,4)];         // bias στο Set 2
  const total = setNum === 2 ? rnd(0, 8) : rnd(0, 12);
  let ga = 0, gb = 0;
  if (setNum === 2) {
    if (total <= 2) { ga = total; gb = 0; }
    else if (total >= 7) { ga = 7; gb = 0; }
    else { ga = rnd(0, total); gb = total - ga; }
  }
  const fav = Math.random() < 0.5 ? 'A' : 'B';
  const favOdds = [1.45, 1.5, 1.55, 1.6, 1.7][rnd(0,4)];
  const dogOdds = favOdds > 0 ? Number((1 / (1 - 1 / favOdds)).toFixed(2)) : 2.4; // χονδρικά αντίστροφο
  const cat = ['ATP 250','WTA 250','Challenger','ITF'][rnd(0,3)];

  const match = makeMatch({
    setNum,
    ga: fav === 'A' ? Math.max(ga, gb) : ga,  // μερικές φορές το fav να "μην χάνει"
    gb: fav === 'A' ? Math.min(ga, gb) : gb,
    oddsFav: fav === 'A' ? favOdds : dogOdds,
    oddsDog: fav === 'A' ? dogOdds : favOdds,
    cat
  });

  const r = analyzeMatch(match);
  const totalGames = (match.players[0].s2 || 0) + (match.players[1].s2 || 0);
  const diff = Math.abs((match.players[0].s2 || 0) - (match.players[1].s2 || 0));
  const favIsA = (match.odds.p1 <= match.odds.p2);
  const favLeading = favIsA
    ? ( (match.players[0].s2 || 0) >= (match.players[1].s2 || 0) )
    : ( (match.players[1].s2 || 0) >= (match.players[0].s2 || 0) );
  const favUsedOdds = favIsA ? match.odds.p1 : match.odds.p2;

  if (r.label === 'SAFE') {
    safeCount++;
    const ok =
      match.status.includes('Set 2') &&
      totalGames >= 3 && totalGames <= 6 &&
      favUsedOdds >= 1.50 &&
      favLeading === true &&
      diff <= 2;

    if (!ok) {
      violations.push({
        setNum,
        ga: match.players[0].s2,
        gb: match.players[1].s2,
        favOdds: favUsedOdds,
        favLeading, diff,
        label: r.label, conf: Number(r.conf?.toFixed?.(3) ?? r.conf)
      });
    }
  }
}

if (violations.length) {
  console.error('❌ Violations:', violations);
  process.exit(1);
}

console.log(`  OK ✓ ${safeCount} SAFE labels observed — all met constraints.`);
console.log('ALL CHECKS PASSED ✓');