// src/utils/aiEngineV2.js
// AI v2.1: odds + sets + games + tier με δυναμικά thresholds.
// Δεν επιστρέφει "AVOID". Στόχος: σταθερά SAFE/RISKY + TIP.

const FIN = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);

const toNum = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function setsWon(aScores, bScores) {
  let a = 0, b = 0;
  for (let i = 0; i < 5; i++) {
    const A = toNum(aScores[i]), B = toNum(bScores[i]);
    if (A === null || B === null) continue;
    if (A > B) a += 1;
    else if (B > A) b += 1;
  }
  return [a, b];
}

function isFinishedLike(s){ return FIN.has(String(s||'').toLowerCase()); }
function isUpcomingLike(s){
  const v = String(s||'').toLowerCase();
  return v === 'not started' || v === 'upcoming' || v === 'scheduled';
}
function isLive(m){
  const s = String(m.status || m['@status'] || '').toLowerCase();
  if (isUpcomingLike(s) || isFinishedLike(s)) return false;
  if (/(live|in ?play|1st|2nd|3rd|set|tiebreak|tb|susp|delay)/.test(s)) return true;
  return Number(m.setNum || 0) > 0;
}

function parseOdds(m){
  const o = m.odds || m.prematchOdds || m.pre || null;
  const asNum = (x) => (x == null ? null : Number(x));
  let p1 = null, p2 = null;

  if (o){
    p1 = asNum(o.p1 ?? o.player1?.decimal ?? o.a ?? o.home ?? o[0]);
    p2 = asNum(o.p2 ?? o.player2?.decimal ?? o.b ?? o.away ?? o[1]);
  }
  if (p1 == null) p1 = asNum(m.p1Odds ?? m.o1 ?? m.homeOdds);
  if (p2 == null) p2 = asNum(m.p2Odds ?? m.o2 ?? m.awayOdds);

  if (!(p1 > 1.01) || !(p2 > 1.01)) return null;

  const ip1 = 1 / p1, ip2 = 1 / p2;
  const z = ip1 + ip2;
  return { p1, p2, ip1: ip1 / z, ip2: ip2 / z };
}

function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }

export default function aiEngineV2(m = {}){
  if (typeof window !== 'undefined') window.__AI_VERSION__ = 'v2.1';

  const players = Array.isArray(m.players) ? m.players
                 : (Array.isArray(m.player) ? m.player : []);
  const p1 = players[0] || {}, p2 = players[1] || {};
  const name1 = p1.name || p1['@name'] || '';
  const name2 = p2.name || p2['@name'] || '';

  const sA = [toNum(p1.s1), toNum(p1.s2), toNum(p1.s3), toNum(p1.s4), toNum(p1.s5)];
  const sB = [toNum(p2.s1), toNum(p2.s2), toNum(p2.s3), toNum(p2.s4), toNum(p2.s5)];
  const [wonA, wonB] = setsWon(sA, sB);

  const setNum = Number(m.setNum || 0);
  const live = isLive(m);

  // current set games diff
  let gDiff = 0;
  if (setNum >= 1) {
    const i = setNum - 1;
    const ga = sA[i] ?? 0, gb = sB[i] ?? 0;
    if (ga != null && gb != null) gDiff = (ga || 0) - (gb || 0);
  }

  // odds
  const odds = parseOdds(m);
  let fav = null, favEdge = 0;
  if (odds){
    if (odds.ip1 >= odds.ip2){ fav = 1; favEdge = odds.ip1 - odds.ip2; }
    else { fav = 2; favEdge = odds.ip2 - odds.ip1; }
  } else {
    fav = (name1.length >= name2.length) ? 1 : 2;
    favEdge = 0.05; // ελάχιστο edge όταν δεν έχουμε odds
  }

  // tier
  const cat = String(m.categoryName || m['@category'] || m.category || '').toLowerCase();
  let tier = 1.0;
  if (/atp|wta/.test(cat)) tier = 1.15;
  else if (/challenger/.test(cat)) tier = 1.05;

  // βάρη
  const W = {
    odds: 1.8,
    sets: 1.4,
    games: 0.9,
    live:  0.6,
    tier,  // multiplier
  };

  const side = (who) => {
    const setsLead  = (who === 1 ? wonA - wonB : wonB - wonA);  // [-5..5]
    const gamesLead = (who === 1 ? gDiff : -gDiff);              // [-7..7]
    const oddsEdge  = (odds ? (who === 1 ? (odds.ip1 - odds.ip2) : (odds.ip2 - odds.ip1))
                            : (who === fav ? favEdge : -favEdge));

    let raw = 0;
    raw += W.odds  * oddsEdge;
    raw += W.sets  * clamp(setsLead / 2, -1, 1);
    raw += W.games * clamp(gamesLead / 3, -1, 1);
    raw += W.live  * (live ? 1 : 0);

    // μικρά boosters όταν υπάρχει ξεκάθαρο momentum
    if (live && setsLead >= 1 && gamesLead >= 2) raw += 0.12;
    if (setNum >= 3) raw += 0.08; // clutch φάσεις

    const score = raw * W.tier;
    const conf  = 1 / (1 + Math.exp(-2.2 * score)); // [0..1]

    return { score, conf, setsLead, gamesLead, oddsEdge };
  };

  const A = side(1), B = side(2);
  const better = (A.score >= B.score) ? 1 : 2;
  const best   = (better === 1 ? A : B);
  const tip    = (better === 1 ? name1 : name2);

  // δυναμικά thresholds
  let thrSAFE  = 0.86;
  let thrRISKY = 0.74;

  if (tier >= 1.15) { thrSAFE -= 0.02; thrRISKY -= 0.02; }           // ATP/WTA
  if (odds && Math.abs(A.oddsEdge) >= 0.20) { thrSAFE -= 0.02; }     // πολύ καθαρές odds
  if (!odds) { thrSAFE += 0.02; thrRISKY += 0.02; }                   // χωρίς odds -> πιο αυστηρά

  let label = null;
  if (best.conf >= thrSAFE) label = 'SAFE';
  else if (best.conf >= thrRISKY) label = 'RISKY';
  if (!label && live) label = `SET ${setNum || 1}`; // ορατότητα στο UI

  let kellyLevel = null;
  if (best.conf >= thrSAFE + 0.04) kellyLevel = 'HIGH';
  else if (best.conf >= thrSAFE)   kellyLevel = 'MED';
  else if (best.conf >= thrRISKY)  kellyLevel = 'LOW';

  return {
    label,                       // 'SAFE' | 'RISKY' | `SET n` | null
    conf: best.conf,
    kellyLevel,
    tip: label ? tip : null,
    reasons: [
      odds ? `oddsEdge=${best.oddsEdge.toFixed(3)}` : 'oddsEdge=N/A',
      `setsLead=${best.setsLead}`,
      `gamesLead=${best.gamesLead}`,
      `tier=${tier}`,
      `live=${live}`,
    ],
    raw: { A, B, setNum, live, tier }
  };
}