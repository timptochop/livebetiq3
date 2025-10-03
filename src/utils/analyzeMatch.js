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
      const vals = Object.values(oddsObj)
        .map(toNum)
        .filter((v) => v > 1);
      if (vals.length >= 2) {
        oA = vals[0];
        oB = vals[1];
      }
    }
  }
  return { oA, oB };
}

function implied(oA, oB) {
  if (oA > 1 && oB > 1) {
    const pa = 1 / oA;
    const pb = 1 / oB;
    const s = pa + pb;
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
    s.includes("set") ||
    s.includes("live") ||
    s.includes("in play") ||
    s.includes("1st") ||
    s.includes("2nd");
  let setNum = 0;
  const mt = /set\s*(\d+)/i.exec(String(m.status || ""));
  if (mt && mt[1]) setNum = Number(mt[1]) || 0;
  const finished = s.includes("finished") || s.includes("retired") || s.includes("walkover");
  const cancelled = s.includes("cancel") || s.includes("postpon");
  return { live, setNum, finished, cancelled };
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

  let base = 0.55 + margin * 0.7 + (status.live ? 0.05 : 0);
  if (status.setNum >= 3) base -= 0.05;
  if (status.finished || status.cancelled) base = 0.52;

  let conf = Math.max(0.51, Math.min(0.99, base));

  let label = "RISKY";
  if (!(oA > 1 && oB > 1)) {
    label = "RISKY";
    conf = Math.max(conf, 0.6);
  } else if (status.finished || status.cancelled) {
    label = "AVOID";
    conf = 0.52;
  } else if (margin >= 0.20) {
    label = "SAFE";
  } else if (margin <= 0.06) {
    label = "AVOID";
    conf = Math.max(0.55, conf);
  } else {
    label = "RISKY";
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
    },
  };
}