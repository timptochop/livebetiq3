// src/utils/analyzeMatch.js
export default function analyzeMatch(match = {}) {
  // ----- guards: only from Set >= 3 -----
  const players = Array.isArray(match.players) ? match.players
                : (Array.isArray(match.player) ? match.player : []);
  const p1 = players[0] || {}, p2 = players[1] || {};
  const setNum = currentSetFromScores(players) || setFromStatus(match.status) || 0;
  if (setNum < 3) return { label: null, pick: null, reason: 'pre-3rd-set' };

  // ----- simple live signal extraction -----
  const sA = [n(p1.s1), n(p1.s2), n(p1.s3), n(p1.s4), n(p1.s5)];
  const sB = [n(p2.s1), n(p2.s2), n(p2.s3), n(p2.s4), n(p2.s5)];

  const totalGames = sum(sA) + sum(sB);

  // last non-null set score (progress proxy)
  const lastIdx = lastPlayedSetIndex(sA, sB); // 0-based
  const lastSet = lastIdx >= 0 ? { a: sA[lastIdx] ?? 0, b: sB[lastIdx] ?? 0 } : { a:0, b:0 };

  // momentum proxy: difference on last set + serve flag if υπάρχει
  const serveBias =
    (String(p1.serve || '').toLowerCase() === 'true' ? 0.2 : 0) -
    (String(p2.serve || '').toLowerCase() === 'true' ? 0.2 : 0);

  const momentum = clamp((lastSet.a - lastSet.b) / 2 + serveBias, -3, 3);

  // confidence proxy by depth
  const conf =
    totalGames > 32 ? 0.68 :
    totalGames > 24 ? 0.62 :
    totalGames > 16 ? 0.58 : 0.54;

  // EV proxy (απλοποιημένο & σταθερό)
  const ev =
    Math.abs(lastSet.a - lastSet.b) >= 2 ? 0.024 :
    Math.abs(lastSet.a - lastSet.b) === 1 ? 0.022 : 0.018;

  // decision logic
  let label = 'AVOID';
  if (ev > 0.023 && conf > 0.57 && momentum >= 0) label = 'SAFE';
  else if (ev > 0.02 && conf >= 0.54) label = 'RISKY';

  // pick = leading side by total games + momentum
  const lead = sum(sA) - sum(sB) + momentum;
  const pick = lead >= 0 ? (p1.name || p1['@name'] || 'Player 1')
                         : (p2.name || p2['@name'] || 'Player 2');

  const reason = `set${setNum}, dg=${Math.abs(lastSet.a-lastSet.b)}, g=${totalGames}`;

  return { label, pick, reason };
}

/* -------- helpers -------- */
function n(v){ if(v===null||v===undefined) return null; const x=parseInt(String(v).split(/[.:]/)[0],10); return Number.isFinite(x)?x:null; }
function sum(arr){ return (arr||[]).reduce((a,b)=>a+(b||0),0); }
function clamp(x,min,max){ return Math.max(min, Math.min(max,x)); }

function lastPlayedSetIndex(sA, sB){
  for(let i=4;i>=0;i--) if(sA[i]!==null || sB[i]!==null) return i;
  return -1;
}
function setFromStatus(status){
  const s=String(status||'').toLowerCase();
  const m=s.match(/(?:^|\s)([1-5])(?:st|nd|rd|th)?\s*set|set\s*([1-5])/i);
  if(!m) return null;
  return parseInt(m[1]||m[2],10);
}
function currentSetFromScores(players){
  const p = Array.isArray(players)?players:[];
  const a = p[0]||{}, b=p[1]||{};
  const sA=[n(a.s1),n(a.s2),n(a.s3),n(a.s4),n(a.s5)];
  const sB=[n(b.s1),n(b.s2),n(b.s3),n(b.s4),n(b.s5)];
  let k=0; for(let i=0;i<5;i++) if(sA[i]!==null||sB[i]!==null) k=i+1;
  return k||null;
}