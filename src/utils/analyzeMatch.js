// src/utils/analyzeMatch.js
// v3.6-softSafe — ηπιότερα όρια για SAFE/RISKY, μικρότερες ποινές σε drift/πίεση,
// λίγο μεγαλύτερο live bonus, πιο χαλαρό volatility clamp, ίδιο output schema.

function toNum(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }

function pickTwoOdds(oddsObj={},nameA="",nameB=""){
  let oA=0,oB=0;
  if(oddsObj && typeof oddsObj==="object"){
    if(toNum(oddsObj.p1)>1 && toNum(oddsObj.p2)>1){ oA=toNum(oddsObj.p1); oB=toNum(oddsObj.p2); }
    else if(nameA && nameB && toNum(oddsObj[nameA])>1 && toNum(oddsObj[nameB])>1){ oA=toNum(oddsObj[nameA]); oB=toNum(oddsObj[nameB]); }
    else{
      const vals = Object.values(oddsObj).map(toNum).filter(v=>v>1);
      if(vals.length>=2){ oA=vals[0]; oB=vals[1]; }
    }
  }
  return { oA,oB };
}

function implied(oA,oB){
  if(oA>1 && oB>1){
    const pa = 1/oA, pb = 1/oB, s = pa+pb;
    return { pa: pa/s, pb: pb/s };
  }
  return { pa:0.5, pb:0.5 };
}

function parsePlayers(m={}){
  if(Array.isArray(m.players) && m.players.length>=2){
    return [
      (m.players[0]?.name || m.players[0]?.["@name"] || "").trim() || "Player A",
      (m.players[1]?.name || m.players[1]?.["@name"] || "").trim() || "Player B",
    ];
  }
  if(typeof m.name==="string" && m.name.includes(" vs ")){
    const [a,b] = m.name.split(" vs ");
    return [(a||"").trim() || "Player A", (b||"").trim() || "Player B"];
  }
  return ["Player A","Player B"];
}

function parseStatus(m={}){
  const raw = String(m.status || m["@status"] || "");
  const s = raw.toLowerCase();
  const live = s.includes("set") || s.includes("live") || s.includes("in play") || s.includes("1st") || s.includes("2nd");
  let setNum = 0; const mt = /set\s*(\d+)/i.exec(raw); if(mt && mt[1]) setNum = Number(mt[1])||0;
  const finished  = s.includes("finished") || s.includes("retired") || s.includes("walkover") || s.includes("walk over") || s.includes("abandoned");
  const cancelled = s.includes("cancel") || s.includes("postpon");
  return { live, setNum, finished, cancelled };
}

function categoryWeight(m={}){
  const cat = (m.categoryName || m.category || m["@category"] || "").toString().toLowerCase();
  if (cat.includes("atp") || cat.includes("wta")) return 0.07;
  if (cat.includes("challenger"))             return 0.03;
  if (cat.includes("itf"))                    return -0.05;
  return 0.0;
}

function readSetGames(p, idx){
  const key = "s"+idx;
  if(!p) return null;
  const v = p[key];
  if(v!==undefined && v!==null && v!=="") return toNum(v);
  return null;
}

function computeMomentum(m,favIsA){
  if(!Array.isArray(m.players)||m.players.length<2) return 0;
  const A=m.players[0]||{}, B=m.players[1]||{};
  let setsCounted=0, setsLeadA=0, lastDiff=0;
  for(let i=1;i<=5;i++){
    const ga=readSetGames(A,i), gb=readSetGames(B,i);
    if(ga===null||gb===null) break;
    if(ga===0 && gb===0)    break;
    setsCounted++;
    if(ga>gb) setsLeadA++;
    if(ga!==gb) lastDiff = ga-gb;
  }
  if(setsCounted===0) return 0;
  const setsLead = setsLeadA - (setsCounted-setsLeadA);
  let score = 0.02*setsLead + 0.01*lastDiff;
  if(!favIsA) score = -score;
  if(score> 0.06) score= 0.06;
  if(score<-0.04) score=-0.04;
  return score;
}

function detectSurface(m={}){
  const fields = [m.surface,m.court,m.courtType,m.categoryName,m.league,m.tournament,m.info,m.meta]
    .filter(Boolean).map(x=>String(x).toLowerCase()).join(" ");
  if(fields.includes("clay"))   return "clay";
  if(fields.includes("grass"))  return "grass";
  if(fields.includes("indoor")) return "indoor";
  if(fields.includes("hard"))   return "hard";
  return "";
}
function surfaceAdj(surf){
  if(surf==="grass")  return 0.025; // + από v3.5
  if(surf==="hard")   return 0.010;
  if(surf==="indoor") return 0.010;
  if(surf==="clay")   return -0.010; // λιγότερο αυστηρό
  return 0.0;
}

function parseStartTs(m={}){
  const d = String(m.date||m["@date"]||"").trim();
  const t = String(m.time||m["@time"]||"").trim();
  const md = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const mt = t.match(/^(\d{2}):(\d{2})$/);
  if(!md || !mt) return null;
  const dd=Number(md[1]), mm=Number(md[2])-1, yyyy=Number(md[3]);
  const hh=Number(mt[1]), min=Number(mt[2]);
  const ts = new Date(yyyy,mm,dd,hh,min).getTime();
  return Number.isFinite(ts) ? ts : null;
}
function timeToStartAdj(m,status){
  if(status.live) return 0;
  const ts = parseStartTs(m);
  if(!ts) return 0;
  const diffMin = Math.round((ts - Date.now())/60000);
  if(diffMin<=0)    return 0.005;
  if(diffMin<=120)  return 0.010;
  if(diffMin<=720)  return 0.000;
  if(diffMin<=1440) return -0.010;
  return -0.020;
}

function currentSetPair(m,status){
  if(!status.live || !Array.isArray(m.players) || m.players.length<2) return {ga:null,gb:null};
  const A=m.players[0]||{}, B=m.players[1]||{};
  const idx = status.setNum>0 ? status.setNum : 1;
  const ga=readSetGames(A,idx), gb=readSetGames(B,idx);
  return { ga, gb };
}

function leadSignal(m){
  if(!Array.isArray(m.players)||m.players.length<2) return {leadA:0,setsCounted:0,currentGames:0};
  const A=m.players[0]||{}, B=m.players[1]||{};
  let setsCounted=0, setsLeadA=0, curGames=0;
  for(let i=1;i<=5;i++){
    const ga=readSetGames(A,i), gb=readSetGames(B,i);
    if(ga===null||gb===null) break;
    if(ga===0 && gb===0)    break;
    setsCounted++;
    if(ga>gb) setsLeadA++;
    if(i===setsCounted) curGames=(ga||0)+(gb||0);
  }
  const leadA = (setsLeadA > (setsCounted-setsLeadA)) ? 1 : (setsLeadA < (setsCounted-setsLeadA) ? -1 : 0);
  return { leadA, setsCounted, currentGames:curGames };
}

function driftGuardAdj(m,status,favIsA,favProb){
  if(!status.live) return 0;
  const sig = leadSignal(m);
  if(sig.setsCounted===0) return 0;
  const strongFav = Math.abs(favProb - 0.5) >= 0.25;
  let adj = 0;

  if(favIsA){
    if(sig.leadA===1){ adj += status.setNum>=2 ? 0.012 : 0.008; }
    else if(sig.leadA===-1){
      let drop = status.setNum>=3 ? 0.020 : (status.setNum===2 ? 0.016 : 0.012); // πιο ήπιο
      if(strongFav) drop *= 0.7;
      adj -= drop;
    }
  }else{
    if(sig.leadA===1){
      let drop = status.setNum>=3 ? 0.020 : (status.setNum===2 ? 0.016 : 0.012);
      if(strongFav) drop *= 0.7;
      adj -= drop;
    }else if(sig.leadA===-1){
      adj += status.setNum>=2 ? 0.012 : 0.008;
    }
  }

  if(status.setNum===1 && sig.currentGames>0 && sig.currentGames<=4){ adj *= 0.7; }
  if(adj> 0.020) adj= 0.020;
  if(adj<-0.025) adj=-0.025; // ηπιότερο min
  return adj;
}

function setPointPressureAdj(m,status,favIsA){
  if(!status.live) return 0;
  const {ga,gb} = currentSetPair(m,status);
  if(ga===null || gb===null) return 0;
  const bothHigh = ga>=5 && gb>=5;
  const diff = Math.abs(ga-gb);
  const tiebreak = ga===6 && gb===6;
  if(!bothHigh) return 0;

  let adj = 0;
  const favLeading  = favIsA ? ga>gb : gb>ga;
  const favTrailing = favIsA ? ga<gb : gb<ga;

  if(tiebreak){
    if(favLeading)  adj += 0.012;
    if(favTrailing) adj -= 0.020; // ηπιότερο
  }else if(diff<=1){
    if(favLeading)  adj += 0.010;
    if(favTrailing) adj -= 0.015; // ηπιότερο
  }
  if(status.setNum>=3) adj *= 1.1; // μικρότερο scale από πριν
  if(adj> 0.018) adj= 0.018;
  if(adj<-0.022) adj=-0.022;
  return adj;
}

function isTenseSet(m,status){
  const {ga,gb} = currentSetPair(m,status);
  if(ga===null||gb===null) return false;
  return (ga>=5 && gb>=5) || (ga===6 && gb===6);
}

function applyVolatilityClamp(confBase,confNow,m,status,favIsA,favProb){
  if(!status.live) return confNow;
  if(!isTenseSet(m,status)) return confNow;

  // πιο χαλαρό clamp
  const maxUp=0.060, maxDown=-0.040;
  let delta = confNow - confBase;

  const heavyFav = favProb>=0.66;
  const {ga,gb} = currentSetPair(m,status);
  const favTrailing = favIsA ? ga<gb : gb<ga;
  if(heavyFav && favTrailing){ if(delta<-0.032) delta=-0.032; }

  if(delta>maxUp)   delta=maxUp;
  if(delta<maxDown) delta=maxDown;
  return confBase + delta;
}

export default function analyzeMatch(m={}){
  const [pA,pB] = parsePlayers(m);
  const status  = parseStatus(m);
  const oddsObj = m.odds || m.market || m.oddsFT || {};
  const {oA,oB} = pickTwoOdds(oddsObj,pA,pB);
  const {pa,pb} = implied(oA,oB);
  const favIsA  = pa>=pb;
  const favName = favIsA ? pA : pB;
  const favProb = favIsA ? pa : pb;

  // Gates (ίδια συμπεριφορά UI)
  if(!status.live){ return { label:"UPCOMING", conf:0, kellyLevel:"LOW", tip:"", features:{ setNum:status.setNum||0, live:0 } }; }
  if(status.setNum===1){ return { label:"SET 1", conf:0, kellyLevel:"LOW", tip:"", features:{ setNum:1, live:1 } }; }
  if(status.setNum>=3){ return { label:"SET 3", conf:0, kellyLevel:"LOW", tip:"", features:{ setNum:status.setNum, live:1 } }; }

  const {ga,gb} = currentSetPair(m,status);
  if(ga!==null && gb!==null){
    const total   = (ga||0)+(gb||0);
    const tieBreak= ga>=6 && gb>=6;
    if(tieBreak){ return { label:"AVOID", conf:0, kellyLevel:"LOW", tip:"", features:{ setNum:2, live:1 } }; }
    if(total<3){  return { label:"SET 2", conf:0, kellyLevel:"LOW", tip:"", features:{ setNum:2, live:1 } }; }
    if(total>6){  return { label:"AVOID", conf:0, kellyLevel:"LOW", tip:"", features:{ setNum:2, live:1 } }; }
  }

  const catBonus  = categoryWeight(m);
  const liveBonus = 0.04; // +0.01 από πριν

  // Βάση εμπιστοσύνης
  const confBase = (oA>1 && oB>1)
    ? 0.50 + ((favProb-0.5)*1.20) + catBonus + liveBonus
    : 0.58 + catBonus;

  let conf = confBase;

  // Live dynamics & context
  conf += computeMomentum(m,favIsA);
  const surf = detectSurface(m); conf += surfaceAdj(surf);
  conf += timeToStartAdj(m,status);
  conf += driftGuardAdj(m,status,favIsA,favProb);
  conf += setPointPressureAdj(m,status,favIsA);

  // Volatility clamp (πιο χαλαρό)
  conf = applyVolatilityClamp(confBase,conf,m,status,favIsA,favProb);

  // Τελικές φρουρές
  if(status.setNum>=3)                 conf -= 0.03;
  if(status.finished || status.cancelled) conf = 0.52;

  // Όρια
  conf = Math.max(0.51, Math.min(0.95, conf));

  // Labels — χαλαρωμένα thresholds
  let label;
  if(status.finished || status.cancelled){
    label = "AVOID";
  } else if(!(oA>1 && oB>1)){
    label = conf >= 0.68 ? "RISKY" : "AVOID"; // λίγο πιο ήπιο
  } else if(conf >= 0.74){
    label = "SAFE";                           // 0.78 ➜ 0.74
  } else if(conf >= 0.60){
    label = "RISKY";                          // 0.62 ➜ 0.60
  } else {
    label = "AVOID";
  }

  const kellyLevel = conf>=0.85 ? "HIGH" : (conf>=0.72 ? "MED" : "LOW");
  const tip = label!=="AVOID" ? `${favName} to win match` : "";

  return {
    label,
    conf,
    kellyLevel,
    tip,
    features:{
      pOdds:{a:oA,b:oB},
      favName,
      favProb,
      setNum:status.setNum,
      live:status.live?1:0,
      catBonus,
      surface:surf
    }
  };
}