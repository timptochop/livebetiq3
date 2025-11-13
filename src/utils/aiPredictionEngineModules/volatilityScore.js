function toInt(v){ const n=parseInt(v,10); return Number.isFinite(n)?n:0; }
function toBool(v){ if(typeof v==="boolean")return v; if(v===1||v==="1")return true; if(v===0||v==="0")return false; return false; }
function sign01(v){ const n=Number(v); if(!Number.isFinite(n))return 0; return n>0?1:n<0?-1:0; }
function clamp(x,a,b){ const n=Number(x); if(!Number.isFinite(n))return a; return n<a?a:n>b?b:n; }
function lerp(a,b,t){ t=clamp(t,0,1); return a+(b-a)*t; }
function round2(x){ return Math.round((Number(x)||0)*100)/100; }

function computeVolatility(match={}){
  const players = Array.isArray(match.players)?match.players:[];
  const A = players[0]||{};
  const B = players[1]||{};
  const gA = toInt(A.games!=null?A.games:(A.g!=null?A.g:A.currentGame));
  const gB = toInt(B.games!=null?B.games:(B.g!=null?B.g:B.currentGame));
  const totalGames = gA + gB;

  const lastSetWinner =
    sign01(match.lastSetWinner) ||
    sign01(match.momentum && match.momentum.lastSetWinner) ||
    0;

  const isTiebreak =
    !!match.isTiebreak ||
    toBool(match.score && match.score.tiebreak) ||
    toBool(A.tiebreak) ||
    toBool(B.tiebreak);

  let v = 0.5;
  if (isTiebreak){
    v = 0.9;
  } else if (totalGames >= 4 && totalGames <= 10){
    const diff = Math.abs(gA-gB);
    if (diff <= 1) v = 0.8;
    else if (diff === 2) v = 0.6;
    else v = 0.4;
  } else if (totalGames > 10){
    v = 0.35;
  } else {
    v = 0.5;
  }

  const momentumMag = Math.abs(lastSetWinner);
  v = lerp(v, Math.max(0.25, v-0.15), 0.35*momentumMag);

  const score = clamp(round2(v),0,1);
  const level = score < 0.25 ? "LOW" : score < 0.5 ? "MEDIUM" : score < 0.75 ? "HIGH" : "EXTREME";
  const kellyAdj = clamp(1 - 0.5*score, 0.35, 1.05);

  return {
    ok: true,
    score,
    level,
    kellyAdj,
    features: {
      totalGames,
      gameDiff: Math.abs(gA-gB),
      isTiebreak: !!isTiebreak,
      lastSetWinner
    }
  };
}

function volatilityScore(match={}){
  return computeVolatility(match).score;
}

try { module.exports = { volatilityScore, computeVolatility }; } catch(_){}
export { volatilityScore, computeVolatility };
export default volatilityScore;