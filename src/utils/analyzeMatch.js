// src/utils/analyzeMatch.js
function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function pickTwoOdds(oddsObj = {}, nameA = "", nameB = "") {
  let oA = 0, oB = 0;
  if (oddsObj && typeof oddsObj === "object") {
    if (toNum(oddsObj.p1) > 1 && toNum(oddsObj.p2) > 1) {
      oA = toNum(oddsObj.p1);
      oB = toNum(oddsObj.p2);
    } else if (nameA && nameB && toNum(oddsObj[nameA]) > 1 && toNum(oddsObj[nameB]) > 1) {
      oA = toNum(oddsObj[nameA]);
      oB = toNum(oddsObj[nameB]);
    } else {
      const vals = Object.values(oddsObj).map(toNum).filter((v) => v > 1);
      if (vals.length >= 2) { oA = vals[0]; oB = vals[1]; }
    }
  }
  return { oA, oB };
}

function implied(oA, oB) {
  if (oA > 1 && oB > 1) {
    const pa = 1 / oA, pb = 1 / oB, s = pa + pb;
    return { pa: pa / s, pb: pb / s };
  }
  return { pa: 0.5, pb: 0.5 };
}

function parsePlayers(m = {}) {
  if (Array.isArray(m.players) && m.players.length >= 2) {
    return [
      (m.players[0]?.name || "").trim() || "Player A",
      (m.players[1]?.name || "").trim() || "Player B",
    ];
  }
  if (typeof m.name === "string" && m.name.includes(" vs ")) {
    const [a, b] = m.name.split(" vs ");
    return [(a || "").trim() || "Player A", (b || "").trim() || "Player B"];
  }
  return ["Player A", "Player B"];
}

function parseStatus(m = {}) {
  const s = String(m.status || "").toLowerCase();
  const live =
    s.includes("set") || s.includes("live") || s.includes("in play") ||
    s.includes("1st") || s.includes("2nd");
  let setNum = 0;
  const mt = /set\s*(\d+)/i.exec(String(m.status || ""));
  if (mt && mt[1]) setNum = Number(mt[1]) || 0;
  const finished = s.includes("finished") || s.includes("retired") || s.includes("walkover");
  const cancelled = s.includes("cancel") || s.includes("postpon");
  return { live, setNum, finished, cancelled };
}

function categoryWeight(m = {}) {
  const cat = (m.categoryName || m.category || "").toString().toLowerCase();
  if (cat.includes("atp") || cat.includes("wta")) return 0.07;
  if (cat.includes("challenger")) return 0.03;
  if (cat.includes("itf")) return -0.05;
  return 0.0;
}

export default function analyzeMatch(m = {}) {
  const [pA, pB] = parsePlayers(m);
  const status = parseStatus(m);
  const oddsObj = m.odds || m.market || m.oddsFT || {};
  const { oA, oB } = pickTwoOdds(oddsObj, pA, pB);
  const { pa, pb } = implied(oA, oB);

  const favName = pa >= pb ? pA : pB;
  const favProb = pa >= pb ? pa : pb;
  const margin = Math.abs(favProb - 0.5);

  const catBonus = categoryWeight(m);
  const liveBonus = status.live ? 0.03 : 0.0;

  let conf;
  if (oA > 1 && oB > 1) {
    conf = 0.50 + (favProb - 0.5) * 1.20 + catBonus + liveBonus;
  } else {
    conf = 0.58 + catBonus; // χωρίς αποδόσεις, συντηρητικό baseline
  }

  if (status.setNum >= 3) conf -= 0.03;
  if (status.finished || status.cancelled) conf = 0.52;

  conf = Math.max(0.51, Math.min(0.95, conf));

  let label;
  if (status.finished || status.cancelled) {
    label = "AVOID";
  } else if (!(oA > 1 && oB > 1)) {
    label = conf >= 0.70 ? "RISKY" : "AVOID";
  } else if (conf >= 0.78) {
    label = "SAFE";
  } else if (conf >= 0.62) {
    label = "RISKY";
  } else {
    label = "AVOID";
  }

  const kellyLevel = conf >= 0.85 ? "HIGH" : conf >= 0.72 ? "MED" : "LOW";
  const tip = label !== "AVOID" ? `TIP: ${favName} to win match` : "";

  return {
    label,
    conf,
    kellyLevel,
    tip,
    features: {
      pOdds: { a: oA, b: oB },
      favName,
      favProb,
      margin,
      setNum: status.setNum,
      live: status.live ? 1 : 0,
      catBonus,
    },
  };
}