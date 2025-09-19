// src/utils/analyzeMatch.js
//
// AI v1.5 – mid-3rd gating + momentum + surface weighting + break-point awareness + Kelly guard
// Returns { label, tip, pick, kellyLevel, reason }  (no EV/Conf numbers in UI)

import { findOddsForPick, guardLabelByKelly } from "./oddsUtils";

export default function analyzeMatch(match = {}) {
  const players = Array.isArray(match.players)
    ? match.players
    : (Array.isArray(match.player) ? match.player : []);
  const p1 = players[0] || {};
  const p2 = players[1] || {};

  // --- which set / surface ---
  const setNum = currentSetFromScores(players) ?? setFromStatus(match.status) ?? 0;
  const surface = parseSurface(match.categoryName || match.category || match.surface || "");

  // --- gating: only from mid-3rd set and later ---
  if (!isAfterMidThirdSet(players, setNum, match)) {
    return { label: null, tip: null, pick: null, kellyLevel: null, reason: "pre-mid-3rd" };
  }

  // --- set scores ---
  const sA = [n(p1.s1), n(p1.s2), n(p1.s3), n(p1.s4), n(p1.s5)];
  const sB = [n(p2.s1), n(p2.s2), n(p2.s3), n(p2.s4), n(p2.s5)];
  const lastIdx = lastPlayedSetIndex(sA, sB);
  const curA = sA[lastIdx] ?? 0;
  const curB = sB[lastIdx] ?? 0;
  const curLead = curA - curB;
  const curTotal = curA + curB;

  // --- point-level & serve ---
  const { vA, vB } = currentPointValues(p1.game_score, p2.game_score);
  const serveA = asBool(p1.serve), serveB = asBool(p2.serve);
  const pointLead = pointDiffToUnit(vA, vB); // [-1..+1]
  const serveBias = (serveA ? 0.22 : 0) - (serveB ? 0.22 : 0);

  // --- break-point awareness (delta for A) ---
  const bpDeltaA = breakDeltaForA(serveA, serveB, vA, vB);

  // --- historical momentum ---
  const prevIdx = lastIdx > 0 ? lastIdx - 1 : -1;
  const prevLead = prevIdx >= 0 ? ((sA[prevIdx] ?? 0) - (sB[prevIdx] ?? 0)) : 0;
  const deltaLead = curLead - prevLead;

  // --- surface weights ---
  const w = surfaceWeight(surface);

  // --- total momentum for A ---
  let momentumA = clamp(curLead * 0.9 + deltaLead * 0.6 + pointLead * 0.35 + serveBias + bpDeltaA, -6, 6);
  momentumA *= w.momentumScale;

  // --- confidence proxy (depth & stability) ---
  const totalGames = sum(sA) + sum(sB);
  let conf =
    totalGames > 40 ? 0.71 :
    totalGames > 32 ? 0.66 :
    totalGames > 24 ? 0.61 :
    totalGames > 18 ? 0.58 : 0.55;

  if (curTotal >= 8) conf += 0.03;
  else if (curTotal >= 6) conf += 0.02;

  conf = clamp(conf * w.confScale, 0.50, 0.82);

  // --- EV proxy (hidden) ---
  const absLead = Math.abs(curLead);
  let ev = absLead >= 2 ? 0.024 : (absLead === 1 ? 0.022 : 0.019);
  if (momentumA > 0.8 && curTotal >= 6) ev += 0.002;
  ev += w.evBonus;

  // --- initial label (before Kelly) ---
  let label = "AVOID";
  if (ev > 0.024 && conf > 0.60 && momentumA >= 0) label = "SAFE";
  else if (ev > 0.020 && conf >= 0.56)              label = "RISKY";

  // --- pick name (A if overall + momentum ≥ 0 else B) ---
  const leadAgg = (sum(sA) - sum(sB)) + momentumA;
  const pick = leadAgg >= 0
    ? (p1.name || p1["@name"] || "Player 1")
    : (p2.name || p2["@name"] || "Player 2");

  // --- Kelly guard with market odds (if available) ---
  let kellyLevel = null;
  const oddsForPick = findOddsForPick(pick, match?.odds);
  if (typeof conf === "number" && oddsForPick) {
    const { label: guarded, level } = guardLabelByKelly(label, conf, oddsForPick);
    label = guarded;
    kellyLevel = level; // "LOW" | "MED" | "HIGH" (UI shows ● bullets)
  }

  const reason = `set=${setNum}, curLead=${curLead}, games=${curTotal}, m=${round(momentumA,2)}, surface=${surface||"n/a"}`;
  return { label, tip: pick, pick, kellyLevel, reason };
}

/* ================= helpers ================= */
function n(v){ if(v===null||v===undefined) return null; const x=parseInt(String(v).split(/[.:]/)[0],10); return Number.isFinite(x)?x:null; }
function sum(arr){ return (arr||[]).reduce((a,b)=>a+(b||0),0); }
function clamp(x,min,max){ return Math.max(min, Math.min(max, x)); }
function round(x, d=2){ const k=Math.pow(10,d); return Math.round(x*k)/k; }
function asBool(x){ const s=String(x||"").toLowerCase(); return s==="true"||s==="1"||s==="yes"; }

function lastPlayedSetIndex(sA, sB){
  for(let i=4;i>=0;i--) if(sA[i]!==null || sB[i]!==null) return i;
  return -1;
}

function setFromStatus(status){
  const s=String(status||"").toLowerCase();
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

/* ---------- surface ---------- */
function parseSurface(s){
  const x = String(s||"").toLowerCase();
  if (x.includes("clay")) return "clay";
  if (x.includes("grass")) return "grass";
  if (x.includes("hard"))  return x.includes("indoor") ? "hard-indoor" : "hard";
  return null;
}
function surfaceWeight(surface){
  switch(surface){
    case "hard-indoor": return { momentumScale: 1.05, confScale: 1.03, evBonus: 0.0010 };
    case "hard":       return { momentumScale: 1.02, confScale: 1.01, evBonus: 0.0005 };
    case "grass":      return { momentumScale: 0.98, confScale: 0.99, evBonus: 0.0000 };
    case "clay":       return { momentumScale: 0.96, confScale: 0.98, evBonus: -0.0010 };
    default:           return { momentumScale: 1.00, confScale: 1.00, evBonus: 0.0000 };
  }
}

/* ---------- point score ---------- */
function currentPointValues(gsA, gsB){
  const aTok = normalizePointToken(gsA);
  const bTok = normalizePointToken(gsB);
  return { vA: pointTokenValue(aTok), vB: pointTokenValue(bTok) };
}
function normalizePointToken(s){
  if (!s) return null;
  const str = String(s).replace(/\s+/g,"").toUpperCase(); // "15:30" / "40-AD"
  const parts = str.split(/[:\-]/);
  return parts[0] || null; // token for this player
}
function pointTokenValue(tok){
  if (!tok) return null;
  if (tok === "AD" || tok === "A") return 4;
  if (tok === "40") return 3;
  if (tok === "30") return 2;
  if (tok === "15") return 1;
  if (tok === "0" || tok === "00") return 0;
  return null;
}
function pointDiffToUnit(vA, vB){
  if (vA==null || vB==null) return 0;
  return clamp((vA - vB)/3.0, -1, 1);
}

/* ---------- break-point awareness ---------- */
function breakDeltaForA(serveA, serveB, vA, vB){
  if (vA==null || vB==null) return 0;
  const isBreakForB_whenAserve = (vB===3 && vA<=2) || (vB===4 && vA===3);
  const isBreakForA_whenBserve = (vA===3 && vB<=2) || (vA===4 && vB===3);

  let delta = 0;
  if (serveA && isBreakForB_whenAserve) delta -= 0.6; // against A
  if (serveB && isBreakForA_whenBserve) delta += 0.6; // for A
  if (serveA && vB===3 && vA===0) delta -= 0.2; // 0-40 against A
  if (serveB && vA===3 && vB===0) delta += 0.2; // 0-40 for A
  return delta;
}

/* ---------- mid-3rd gate ---------- */
function isAfterMidThirdSet(players, setNum, match){
  if (setNum < 3) return false;
  const p = Array.isArray(players)?players:[];
  const a = p[0]||{}, b=p[1]||{};
  const sA=[n(a.s1),n(a.s2),n(a.s3),n(a.s4),n(a.s5)];
  const sB=[n(b.s1),n(b.s2),n(b.s3),n(b.s4),n(b.s5)];
  const idx = lastPlayedSetIndex(sA, sB);
  const curTotal = (sA[idx] ?? 0) + (sB[idx] ?? 0);

  if (curTotal >= 4) return true;

  const st = String(match?.status || "").toLowerCase();
  const gm = st.match(/game\s*(\d+)/i);
  if (gm && parseInt(gm[1],10) >= 5) return true;

  return false;
}