// Heuristic v1.2 : safer labeling + probability + kelly level
// Είσοδος: match αντικείμενο όπως έρχεται από feed (players[].s1..s5, status, date/time, category)

const FINISHED = new Set(['finished','cancelled','retired','abandoned','postponed','walk over']);
const isFinishedLike = (s) => FINISHED.has(String(s||'').toLowerCase());
const isUpcoming = (s) => String(s||'').toLowerCase() === 'not started';

const num = v => {
  if (v===null || v===undefined) return null;
  const s = String(v).trim(); if (!s) return null;
  const x = parseInt(s.split(/[.:]/)[0], 10);
  return Number.isFinite(x) ? x : null;
};

function setsWon(p) {
  let w = 0;
  for (let i=1;i<=5;i++){
    const a = num(p[0]?.[`s${i}`]), b = num(p[1]?.[`s${i}`]);
    if (a===null && b===null) continue;
    if ((a ?? -1) > (b ?? -1)) w++;
    if ((b ?? -1) > (a ?? -1)) ; // count for other in caller
  }
  return w;
}
function currentSet(p) {
  let k=0;
  for (let i=1;i<=5;i++){
    const a = num(p[0]?.[`s${i}`]), b = num(p[1]?.[`s${i}`]);
    if (a!==null || b!==null) k = i;
  }
  return k || 1;
}
function gameDiffInSet(p, k) {
  const a = num(p[0]?.[`s${k}`]) ?? 0;
  const b = num(p[1]?.[`s${k}`]) ?? 0;
  return a - b; // + => p1 leads
}

export default function analyzeMatch(m){
  const players = Array.isArray(m.players) ? m.players
                : Array.isArray(m.player)  ? m.player : [];
  const p1 = players[0] || {}, p2 = players[1] || {};
  const name1 = p1.name || p1['@name'] || ''; 
  const name2 = p2.name || p2['@name'] || ''; 

  const status = m.status || m['@status'] || '';
  if (!status) return { label: 'SOON', prob: 0.55, kellyLevel: 'LOW', tip: name1 };

  if (isFinishedLike(status)) {
    return { label: 'AVOID', prob: 0.50, kellyLevel: 'LOW', tip: name1 };
  }
  if (isUpcoming(status)) {
    return { label: 'SOON', prob: 0.55, kellyLevel: 'LOW', tip: name1 };
  }

  // LIVE
  const setNum = currentSet(players);
  const aSets = setsWon(players);
  const bSets = setsWon([players[1], players[0]]);
  const setLead = aSets - bSets;            // + => p1 leads in sets
  const gd = gameDiffInSet(players, setNum); // + => p1 leads in current set

  // Base probability (rough): start at 0.50 then add set/game edges
  let p = 0.50;
  p += 0.10 * setLead;        // each set lead ~ +10%
  p += 0.03 * gd;             // each game lead ~ +3%
  if (setNum >= 3) p += 0.02; // late momentum bonus
  p = Math.max(0.05, Math.min(0.95, p));

  // Winner tip: choose side by prob > 0.5
  const tip = p >= 0.5 ? name1 : name2;
  const prob = p >= 0.5 ? p : (1 - p);

  // Labeling
  let label;
  if (prob >= 0.78 && (setLead > 0 || gd >= 2)) label = 'SAFE';
  else if (prob >= 0.64) label = 'RISKY';
  else if (prob <= 0.58 && setNum === 1) label = 'AVOID';
  else label = `SET ${setNum}`;

  // Kelly “dots”
  let kellyLevel = 'LOW';
  if (prob >= 0.78) kellyLevel = 'HIGH';
  else if (prob >= 0.68) kellyLevel = 'MED';

  return { label, prob: Number(prob.toFixed(2)), kellyLevel, tip };
}