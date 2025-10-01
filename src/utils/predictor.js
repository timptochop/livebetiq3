// Lightweight heuristic predictor that always returns: { label, conf, kellyLevel, tip }
function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function getPlayers(m = {}) {
  const players = Array.isArray(m.players) ? m.players
                : Array.isArray(m.player)  ? m.player  : [];
  const p1 = players[0] || {};
  const p2 = players[1] || {};
  const name1 = p1.name || p1['@name'] || '' ;
  const name2 = p2.name || p2['@name'] || '' ;
  return { name1, name2 };
}

function isUpcoming(status) {
  return String(status || '').toLowerCase() === 'not started';
}
function isFinishedLike(status) {
  const S = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);
  return S.has(String(status || '').toLowerCase());
}

function currentSetFromScores(m = {}) {
  const players = Array.isArray(m.players) ? m.players
                : Array.isArray(m.player)  ? m.player  : [];
  const p1 = players[0] || {};
  const p2 = players[1] || {};
  const sA = [p1.s1,p1.s2,p1.s3,p1.s4,p1.s5].map(x => (x==null?null:parseInt(String(x).split(/[.:]/)[0],10)));
  const sB = [p2.s1,p2.s2,p2.s3,p2.s4,p2.s5].map(x => (x==null?null:parseInt(String(x).split(/[.:]/)[0],10)));
  let k = 0;
  for (let i=0;i<5;i++) if (sA[i]!=null || sB[i]!=null) k=i+1;
  return k || 0;
}

export default function predictor(m = {}) {
  const { name1, name2 } = getPlayers(m);
  const status  = m.status || m['@status'] || '';
  const live    = !!status && !isUpcoming(status) && !isFinishedLike(status);
  const setNum  = currentSetFromScores(m);

  // ---- Features (robust fallbacks) ----
  // Αν δεν έχει odds στα δεδομένα σου, διατηρούμε 0.5 (ουδέτερο)
  const pOddsHome = num(m.oddsHome ?? m.homeOdds ?? m.pOddsHome, 0.5); // [0..1]
  const pOddsAway = 1 - Math.min(Math.max(pOddsHome, 0), 1);

  const f_odds   = Math.max(pOddsHome, pOddsAway);            // “πόσο φαβορί” είναι κάποιος
  const f_live   = live ? 1 : 0;                              // live boost
  const f_set    = Math.min(Math.max(setNum/5, 0), 1);        // progress of match

  // Μικρός bonus στο decider
  const f_decider = setNum >= 3 ? 0.15 : 0.0;

  // ---- Simple logistic scoring ----
  // Βάρη (σταθερά & ακίνδυνα)
  const w_odds = 1.05, w_live = 0.85, w_set = 0.35, w_dec = 0.25;
  const b = -0.90;

  const z = w_odds*f_odds + w_live*f_live + w_set*f_set + w_dec*f_decider + b;
  const conf = 1 / (1 + Math.exp(-z)); // 0..1

  // Κατηγοριοποίηση
  let label;
  if (conf >= 0.86) label = 'SAFE';
  else if (conf >= 0.72) label = 'RISKY';
  else label = 'AVOID';

  const kellyLevel =
    conf >= 0.88 ? 'HIGH' :
    conf >= 0.78 ? 'MED'  : 'LOW';

  // TIP επιλογή: αν pOddsHome >= 0.5 → name1 αλλιώς name2
  let tip = '';
  if (label === 'SAFE' || label === 'RISKY') {
    tip = (pOddsHome >= 0.5 ? name1 : name2) || name1 || name2 || '';
  }

  return {
    label,
    conf,
    kellyLevel,
    tip,
    // διατηρούμε και μερικά διαγνωστικά αν χρειαστούν
    _debug: { f_odds, f_live, f_set, f_decider, setNum }
  };
}