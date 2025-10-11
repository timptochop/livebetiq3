// src/utils/analyzeMatch.js
// v4.0 precision-first — Set2 window (games 3–6), odds floor >= 1.50,
// per-category thresholds (SAFE/RISKY), μικρά σήματα + clamps.

// ---------- Config ----------
const CFG = {
  floors: {
    minOdds: 1.50,
    favProb: 0.54,
    maxSet2Diff_SAFE: 1,
    maxSet2Diff_RISKY: 1
  },
  // Κατηγοριοποιημένα thresholds
  category: {
    atp: { SAFE: 0.83, RISKY: 0.72 },
    wta: { SAFE: 0.83, RISKY: 0.72 },
    ch:  { SAFE: 0.84, RISKY: 0.74 },
    itf: { SAFE: 0.86, RISKY: null }, // null = off
    other: { SAFE: 0.85, RISKY: 0.74 }
  },
  // Βάρη/προσαυξήσεις
  weights: {
    cat:   { atp:+0.07, wta:+0.07, ch:+0.03, itf:-0.05, other:0.00 },
    surf:  { grass:+0.02, hard:+0.01, indoor:+0.01, clay:-0.015, '':0 },
    liveBonus: +0.03,
    clampUp: +0.05,
    clampDown: -0.05
  }
};

// ---------- Helpers ----------
function toNum(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }

function pickTwoOdds(oddsObj={}, nameA="", nameB=""){
  let oA=0,oB=0;
  if (oddsObj && typeof oddsObj==="object"){
    if (toNum(oddsObj.p1)>1 && toNum(oddsObj.p2)>1){ oA=toNum(oddsObj.p1); oB=toNum(oddsObj.p2); }
    else if (nameA && nameB && toNum(oddsObj[nameA])>1 && toNum(oddsObj[nameB])>1){ oA=toNum(oddsObj[nameA]); oB=toNum(oddsObj[nameB]); }
    else { const vals = Object.values(oddsObj).map(toNum).filter(v=>v>1); if (vals.length>=2){ oA=vals[0]; oB=vals[1]; } }
  }
  return { oA, oB };
}

function implied(oA,oB){
  if (oA>1 && oB>1){
    const pa=1/oA, pb=1/oB, s=pa+pb;
    return { pa:pa/s, pb:pb/s };
  }
  return { pa:0.5, pb:0.5 };
}

function parsePlayers(m={}){
  if (Array.isArray(m.players) && m.players.length>=2){
    return [
      (m.players[0]?.name || m.players[0]?.["@name"] || "").trim() || "Player A",
      (m.players[1]?.name || m.players[1]?.["@name"] || "").trim() || "Player B",
    ];
  }
  if (typeof m.name==="string" && m.name.includes(" vs ")){
    const [a,b] = m.name.split(" vs ");
    return [(a||"").trim()||"Player A", (b||"").trim()||"Player B"];
  }
  return ["Player A","Player B"];
}

function parseStatus(m={}){
  const raw = String(m.status || m["@status"] || "");
  const s = raw.toLowerCase();
  const live = s.includes("set") || s.includes("live") || s.includes("in play") || s.includes("1st") || s.includes("2nd");
  let setNum = 0; const mt = /set\s*(\d+)/i.exec(raw); if (mt && mt[1]) setNum = Number(mt[1])||0;
  const finished = s.includes("finished") || s.includes("retired") || s.includes("walkover") || s.includes("walk over") || s.includes("abandoned");
  const cancelled = s.includes("cancel") || s.includes("postpon");
  return { live, setNum, finished, cancelled, raw };
}

function detectCategory(m={}){
  const cat = (m.categoryName || m.category || m["@category"] || "").toString().toLowerCase();
  if (cat.includes("atp")) return "atp";
  if (cat.includes("wta")) return "wta";
  if (cat.includes("challenger")) return "ch";
  if (cat.includes("itf")) return "itf";
  return "other";
}

function readSetGames(p, idx){
  const key="s"+idx; if (!p) return null; const v=p[key];
  if (v!==undefined && v!==null && v!=="") return toNum(v);
  return null;
}

function currentSetPair(m, status){
  if (!status.live || !Array.isArray(m.players) || m.players.length<2) return { ga:null, gb:null };
  const A = m.players[0]||{}, B = m.players[1]||{};
  const idx = status.setNum>0 ? status.setNum : 1;
  const ga = readSetGames(A, idx), gb = readSetGames(B, idx);
  return { ga, gb };
}

function computeMomentum(m, favIsA){
  if (!Array.isArray(m.players) || m.players.length<2) return 0;
  const A=m.players[0]||{}, B=m.players[1]||{};
  let setsCounted=0, setsLeadA=0, lastDiff=0;
  for (let i=1;i<=5;i++){
    const ga=readSetGames(A,i), gb=readSetGames(B,i);
    if (ga===null || gb===null) break;
    if (ga===0 && gb===0) break;
    setsCounted++;
    if (ga>gb) setsLeadA++;
    if (ga!==gb) lastDiff = ga-gb;
  }
  if (setsCounted===0) return 0;
  const setsLead = setsLeadA - (setsCounted - setsLeadA);
  let score = 0.02*setsLead + 0.01*lastDiff;
  if (!favIsA) score = -score;
  if (score>0.06) score = 0.06;
  if (score<-0.04) score = -0.04;
  return score;
}

function detectSurface(m={}){
  const fields = [m.surface,m.court,m.courtType,m.categoryName,m.league,m.tournament,m.info,m.meta]
    .filter(Boolean).map(x=>String(x).toLowerCase()).join(" ");
  if (fields.includes("clay")) return "clay";
  if (fields.includes("grass")) return "grass";
  if (fields.includes("indoor")) return "indoor";
  if (fields.includes("hard")) return "hard";
  return "";
}

function surfaceAdj(surf){
  return CFG.weights.surf[surf] ?? 0;
}

function parseStartTs(m={}){
  const d=String(m.date||m["@date"]||"").trim();
  const t=String(m.time||m["@time"]||"").trim();
  const md=d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const mt=t.match(/^(\d{2}):(\d{2})$/);
  if (!md || !mt) return null;
  const dd=Number(md[1]), mm=Number(md[2])-1, yyyy=Number(md[3]);
  const hh=Number(mt[1]), min=Number(mt[2]);
  const ts=new Date(yyyy,mm,dd,hh,min).getTime();
  return Number.isFinite(ts) ? ts : null;
}
function timeToStartAdj(m, status){
  if (status.live) return 0;
  const ts=parseStartTs(m); if (!ts) return 0;
  const diffMin = Math.round((ts-Date.now())/60000);
  if (diffMin<=0) return 0.005;
  if (diffMin<=120) return 0.01;
  if (diffMin<=720) return 0.0;
  if (diffMin<=1440) return -0.01;
  return -0.02;
}

function set2WindowGuard(status, ga, gb){
  if (status.setNum!==2) return { pass:false, badge:`SET ${status.setNum||1}` };
  if (ga===null || gb===null) return { pass:false, badge:`SET 2` };
  const total = (ga||0)+(gb||0);
  const tieBreak = (ga>=6 && gb>=6);
  if (tieBreak) return { pass:false, badge:'AVOID' };
  if (total < 3) return { pass:false, badge:'SET 2' };
  if (total > 6) return { pass:false, badge:'AVOID' };
  return { pass:true, total, diff:Math.abs((ga||0)-(gb||0)), ga, gb };
}

function volatilityClamp(confBase, confNow){
  let d = confNow - confBase;
  if (d > CFG.weights.clampUp) d = CFG.weights.clampUp;
  if (d < CFG.weights.clampDown) d = CFG.weights.clampDown;
  return confBase + d;
}

// ---------- Main ----------
export default function analyzeMatch(m = {}){
  const [pA,pB] = parsePlayers(m);
  const status = parseStatus(m);
  const oddsObj = m.odds || m.market || m.oddsFT || {};
  const { oA, oB } = pickTwoOdds(oddsObj, pA, pB);
  const { pa, pb } = implied(oA, oB);
  const favIsA = pa >= pb;
  const favName = favIsA ? pA : pB;
  const favProb = favIsA ? pa : pb;
  const favOdds = favIsA ? oA : oB;

  // Early gates
  if (!status.live) return { label:"UPCOMING", conf:0, kellyLevel:"LOW", tip:"", features:{ setNum:status.setNum||0, live:0 } };
  if (status.setNum===1) return { label:"SET 1", conf:0, kellyLevel:"LOW", tip:"", features:{ setNum:1, live:1 } };
  if (status.setNum>=3) return { label:"SET 3", conf:0, kellyLevel:"LOW", tip:"", features:{ setNum:status.setNum, live:1 } };

  // Set2 window (games 3–6, no TB)
  const { ga, gb } = currentSetPair(m, status);
  const win = set2WindowGuard(status, ga, gb);
  if (!win.pass) return { label: win.badge, conf:0, kellyLevel:"LOW", tip:"", features:{ setNum:status.setNum, live:1 } };

  // Category & weights
  const catKey = detectCategory(m);
  const catBonus = CFG.weights.cat[catKey] ?? 0;
  const liveBonus = CFG.weights.liveBonus;

  // Base confidence από implied + category + live
  const confBase = (oA>1 && oB>1)
    ? (0.50 + ((favProb-0.5)*1.20) + catBonus + liveBonus)
    : (0.58 + catBonus);

  // Contextual nudges
  let conf = confBase;
  conf += computeMomentum(m, favIsA);
  const surf = detectSurface(m); conf += surfaceAdj(surf);
  conf += timeToStartAdj(m, status);

  // Clamp → confFinal
  let confFinal = Math.max(0.51, Math.min(0.95, volatilityClamp(confBase, conf)));

  // Precision filters
  const favLeading = favIsA ? ((ga||0) >= (gb||0)) : ((gb||0) >= (ga||0));
  const oddsOk = Number.isFinite(favOdds) && favOdds >= CFG.floors.minOdds;
  const probOk = favProb >= CFG.floors.favProb;

  // Thresholds ανά category
  const thr = CFG.category[catKey] || CFG.category.other;

  // Απόφαση
  let label = 'AVOID';
  let tip = '';

  // SAFE: αυστηρό diff ≤ 1 + cat-threshold
  if (oddsOk && probOk && favLeading && win.diff <= CFG.floors.maxSet2Diff_SAFE && confFinal >= (thr.SAFE ?? 1)){
    label = 'SAFE';
    tip = `${favName} to win match`;
  }
  // RISKY: ίδιο diff ≤ 1, χαμηλότερο threshold αν επιτρέπεται για την κατηγορία
  else if (oddsOk && probOk && favLeading && win.diff <= CFG.floors.maxSet2Diff_RISKY && (thr.RISKY!=null) && confFinal >= thr.RISKY){
    label = 'RISKY';
    tip = `${favName} to win match`;
  } else {
    label = 'AVOID';
  }

  const kellyLevel = confFinal >= 0.90 ? 'HIGH' : confFinal >= 0.80 ? 'MED' : 'LOW';

  return {
    label,
    conf: confFinal,
    kellyLevel,
    tip,
    features: {
      pOdds: { a:oA, b:oB },
      favName,
      favProb,
      favOdds,
      setNum: status.setNum,
      live: status.live ? 1 : 0,
      category: catKey,
      catBonus,
      surface: surf,
      set2Total: win.total,
      set2Diff: win.diff
    }
  };
}