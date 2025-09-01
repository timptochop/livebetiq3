// src/utils/analyzeMatch.js

function n(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const i = s.split(/[.:]/)[0];
  const x = parseInt(i, 10);
  return Number.isFinite(x) ? x : null;
}

function getPlayers(match) {
  const p = match.players || match.player || match.playersList || [];
  const a = Array.isArray(p) ? p[0] || {} : {};
  const b = Array.isArray(p) ? p[1] || {} : {};
  const wrap = (o) => ({
    name: o.name || o['@name'] || '',
    s: [
      n(o.s1 || o['@s1']),
      n(o.s2 || o['@s2']),
      n(o.s3 || o['@s3']),
      n(o.s4 || o['@s4']),
      n(o.s5 || o['@s5']),
    ],
  });
  return { A: wrap(a), B: wrap(b) };
}

function currentSetNum(A, B) {
  let k = 0;
  for (let i = 0; i < 5; i++) {
    const av = A.s[i], bv = B.s[i];
    if (av !== null || bv !== null) k = i + 1;
  }
  return k || 1;
}
function setWins(A, B) {
  let wa = 0, wb = 0;
  for (let i = 0; i < 5; i++) {
    const av = A.s[i], bv = B.s[i];
    if (av === null || bv === null) continue;
    if (av > bv) wa++; else if (bv > av) wb++;
  }
  return { wa, wb };
}
function gamesAgg(A, B) {
  let ga = 0, gb = 0;
  for (let i = 0; i < 5; i++) {
    if (A.s[i] !== null) ga += A.s[i];
    if (B.s[i] !== null) gb += B.s[i];
  }
  return { ga, gb, diff: ga - gb };
}

function estimateBaseConfidence(wa, wb, ga, gb, setNum) {
  let base = 50;
  base += Math.max(-20, Math.min(20, (wa - wb) * 10));
  base += Math.max(-10, Math.min(10, ga - gb));
  base += Math.max(0, Math.min(10, (setNum - 2) * 2));
  if (setNum >= 5) base -= 6;
  if (base < 0) base = 0;
  if (base > 100) base = 100;
  return Math.round(base);
}
function labelFromConfidence(c) {
  if (c >= 70) return 'SAFE';
  if (c >= 60) return 'RISKY';
  return 'AVOID';
}

// Momentum -------------------------------------------------------------
function calculateMomentum(A, B, setNum) {
  const flags = [];
  if (setNum < 3) return { lead: null, score: 0, flags };

  const lastIdx = Math.max(0, Math.min(setNum - 2, 4));
  const prevIdx = lastIdx - 1;

  let scoreA = 0, scoreB = 0;

  if (A.s[lastIdx] !== null && B.s[lastIdx] !== null) {
    const margin = A.s[lastIdx] - B.s[lastIdx];
    if (margin >= 3) { scoreA += 8; flags.push('lastset_bigwin_A'); }
    if (margin <= -3) { scoreB += 8; flags.push('lastset_bigwin_B'); }
  }

  if (prevIdx >= 0 && A.s[prevIdx] !== null && B.s[prevIdx] !== null &&
      A.s[lastIdx] !== null && B.s[lastIdx] !== null) {
    const winPrevA = A.s[prevIdx] > B.s[prevIdx];
    const winPrevB = B.s[prevIdx] > A.s[prevIdx];
    const winLastA = A.s[lastIdx] > B.s[lastIdx];
    const winLastB = B.s[lastIdx] > A.s[lastIdx];

    if (winPrevA && winLastA) { scoreA += 12; flags.push('streak2_A'); }
    if (winPrevB && winLastB) { scoreB += 12; flags.push('streak2_B'); }

    const swing = (A.s[prevIdx] + A.s[lastIdx]) - (B.s[prevIdx] + B.s[lastIdx]);
    if (swing >= 4) { scoreA += 6; flags.push('swing_A'); }
    if (swing <= -4) { scoreB += 6; flags.push('swing_B'); }
  }

  if (scoreA === scoreB) return { lead: null, score: 0, flags };
  if (scoreA > scoreB) return { lead: 'A', score: scoreA - scoreB, flags };
  return { lead: 'B', score: scoreB - scoreA, flags };
}

function applyMomentumToConfidence(conf, pickName, A, B, momentum) {
  if (!pickName || !momentum || momentum.score === 0 || !momentum.lead) return {
    confidence: conf, delta: 0
  };

  const pickedIsA = pickName === A.name;
  const pickedIsB = pickName === B.name;

  let delta = 0;
  const capped = Math.min(10, Math.max(4, Math.round(momentum.score)));
  if (momentum.lead === 'A') {
    delta = pickedIsA ? +capped : -Math.min(8, capped - 1);
  } else if (momentum.lead === 'B') {
    delta = pickedIsB ? +capped : -Math.min(8, capped - 1);
  }

  let newConf = conf + delta;
  if (newConf < 0) newConf = 0;
  if (newConf > 100) newConf = 100;
  return { confidence: Math.round(newConf), delta };
}

// Odds calibration ------------------------------------------------------
function applyOddsCalibration(conf, pickName, A, B, odds) {
  if (!odds || typeof odds.imp1 !== 'number' || typeof odds.imp2 !== 'number') {
    return { confidence: conf, delta: 0, agree: null };
  }

  const fav = odds.imp1 >= odds.imp2 ? 'A' : 'B';
  const gap = Math.abs(odds.imp1 - odds.imp2); // 0..1
  const strength = Math.min(12, Math.max(4, Math.round(gap * 20))); // 4..12 περίπου

  const pickIsA = pickName === A.name;
  const pickIsB = pickName === B.name;

  let delta = 0;
  let agree = null;
  if ((fav === 'A' && pickIsA) || (fav === 'B' && pickIsB)) {
    delta = +strength; agree = true;
  } else {
    delta = -strength; agree = false;
  }

  let newConf = conf + delta;
  if (newConf < 0) newConf = 0;
  if (newConf > 100) newConf = 100;

  return { confidence: Math.round(newConf), delta, agree };
}

// Main ------------------------------------------------------------------
export default function analyzeMatch(match) {
  const { A, B } = getPlayers(match);
  const setNum = currentSetNum(A, B);

  if (setNum < 3) {
    return {
      label: 'PENDING',
      pick: null,
      confidence: 0,
      reason: 'early_sets',
      meta: { setNum, phase: 'pending' }
    };
  }

  const { wa, wb } = setWins(A, B);
  const { ga, gb } = gamesAgg(A, B);

  let pick = null;
  if (wa !== wb) pick = wa > wb ? A.name : B.name;
  else if (ga !== gb) pick = ga > gb ? A.name : B.name;
  else pick = A.name || B.name || null;

  let conf = estimateBaseConfidence(wa, wb, ga, gb, setNum);

  const mom = calculateMomentum(A, B, setNum);
  const mAdj = applyMomentumToConfidence(conf, pick, A, B, mom);
  conf = mAdj.confidence;

  const odds = match?.prediction?.odds || match?.odds || null;
  const oAdj = applyOddsCalibration(conf, pick, A, B, odds);
  conf = oAdj.confidence;

  const label = labelFromConfidence(conf);

  const flags = [];
  if (mom.flags?.length) flags.push(...mom.flags);
  if (mAdj.delta) flags.push((mAdj.delta > 0 ? 'momentum_boost_' : 'momentum_penalty_') + Math.abs(mAdj.delta));
  if (typeof oAdj.agree === 'boolean') flags.push(oAdj.agree ? 'odds_agree' : 'odds_disagree');
  if (oAdj.delta) flags.push((oAdj.delta > 0 ? 'odds_boost_' : 'odds_penalty_') + Math.abs(oAdj.delta));

  return {
    label,
    pick,
    confidence: conf,
    reason: `sets_${wa}-${wb}_games_${ga}-${gb}_set${setNum}${flags.length ? '_' + flags.join('|') : ''}`,
    meta: {
      setNum,
      sets: { A: wa, B: wb },
      games: { A: ga, B: gb },
      momentum: mom,
      odds
    }
  };
}