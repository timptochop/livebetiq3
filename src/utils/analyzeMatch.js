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
  const live = s.includes("set") || s.includes("live") || s.includes("in play") || s.includes("1st") || s.includes("2nd");
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

function readSetGames(p, idx) {
  const key = "s" + idx;
  if (!p) return null;
  if (p[key] !== undefined && p[key] !== null && p[key] !== "") return toNum(p[key]);
  return null;
}

function computeMomentum(m, favIsA) {
  if (!Array.isArray(m.players) || m.players.length < 2) return 0;
  const A = m.players[0] || {}, B = m.players[1] || {};
  let setsCounted = 0, setsLeadA = 0, lastDiff = 0;
  for (let i = 1; i <= 5; i++) {
    const ga = readSetGames(A, i);
    const gb = readSetGames(B, i);
    if (ga === null || gb === null) break;
    if (ga === 0 && gb === 0) break;
    setsCounted++;
    if (ga > gb) setsLeadA++;
    if (ga !== gb) lastDiff = ga - gb;
  }
  if (setsCounted === 0) return 0;
  const setsLead = setsLeadA - (setsCounted - setsLeadA);
  let score = 0.02 * setsLead + 0.01 * lastDiff;
  if (!favIsA) score = -score;
  if (score > 0.06) score = 0.06;
  if (score < -0.04) score = -0.04;
  return score;
}

function detectSurface(m = {}) {
  const fields = [
    m.surface, m.court, m.courtType, m.categoryName, m.league, m.tournament, m.info, m.meta
  ].filter(Boolean).map(x => String(x).toLowerCase()).join(" ");
  if (fields.includes("clay")) return "clay";
  if (fields.includes("grass")) return "grass";
  if (fields.includes("indoor")) return "indoor";
  if (fields.includes("hard")) return "hard";
  return "";
}

function surfaceAdj(surf) {
  if (surf === "grass") return 0.02;
  if (surf === "hard") return 0.01;
  if (surf === "indoor") return 0.01;
  if (surf === "clay") return -0.015;
  return 0.0;
}

function parseStartTs(m = {}) {
  const d = String(m.date || "").trim();
  const t = String(m.time || "").trim();
  const md = d.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  const mt = t.match(/^(\d{2}):(\d{2})$/);
  if (!md || !mt) return null;
  const dd = Number(md[1]), mm = Number(md[2]) - 1, yyyy = Number(md[3]);
  const hh = Number(mt[1]), min = Number(mt[2]);
  const ts = new Date(yyyy, mm, dd, hh, min).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function timeToStartAdj(m, status) {
  if (status.live) return 0;
  const ts = parseStartTs(m);
  if (!ts) return 0;
  const diffMin = Math.round((ts - Date.now()) / 60000);
  if (diffMin <= 0) return 0.005;
  if (diffMin <= 120) return 0.01;
  if (diffMin <= 720) return 0.0;
  if (diffMin <= 1440) return -0.01;
  return -0.02;
}

function leadSignal(m) {
  if (!Array.isArray(m.players) || m.players.length < 2) return { leadA: 0, setsCounted: 0, currentGames: 0 };
  const A = m.players[0] || {}, B = m.players[1] || {};
  let setsCounted = 0, setsLeadA = 0, curGames = 0;
  for (let i = 1; i <= 5; i++) {
    const ga = readSetGames(A, i);
    const gb = readSetGames(B, i);
    if (ga === null || gb === null) break;
    if (ga === 0 && gb === 0) break;
    setsCounted++;
    if (ga > gb) setsLeadA++;
    if (i === setsCounted) curGames = (ga || 0) + (gb || 0);
  }
  const leadA = setsLeadA > (setsCounted - setsLeadA) ? 1 : (setsLeadA < (setsCounted - setsLeadA) ? -1 : 0);
  return { leadA, setsCounted, currentGames: curGames };
}

function driftGuardAdj(m, status, favIsA, favProb) {
  if (!status.live) return 0;
  const sig = leadSignal(m);
  if (sig.setsCounted === 0) return 0;
  const strongFav = Math.abs(favProb - 0.5) >= 0.25;
  let adj = 0;
  if (favIsA) {
    if (sig.leadA === 1) {
      adj += status.setNum >= 2 ? 0.015 : 0.01;
    } else if (sig.leadA === -1) {
      let drop = status.setNum >= 3 ? 0.03 : status.setNum === 2 ? 0.02 : 0.015;
      if (strongFav) drop *= 0.6;
      adj -= drop;
    }
  } else {
    if (sig.leadA === 1) {
      let drop = status.setNum >= 3 ? 0.03 : status.setNum === 2 ? 0.02 : 0.015;
      if (strongFav) drop *= 0.6;
      adj -= drop;
    } else if (sig.leadA === -1) {
      adj += status.setNum >= 2 ? 0.015 : 0.01;
    }
  }
  if (status.setNum === 1 && sig.currentGames > 0 && sig.currentGames <= 4) {
    adj *= 0.7;
  }
  if (adj > 0.03) adj = 0.03;
  if (adj < -0.04) adj = -0.04;
  return adj;
}

export default function analyzeMatch(m = {}) {
  const [pA, pB] = parsePlayers(m);
  const status = parseStatus(m);
  const oddsObj = m.odds || m.market || m.oddsFT || {};
  const { oA, oB } = pickTwoOdds(oddsObj, pA, pB);
  const { pa, pb } = implied(oA, oB);
  const favIsA = pa >= pb;
  const favName = favIsA ? pA : pB;
  const favProb = favIsA ? pa : pb;
  const margin = Math.abs(favProb - 0.5);
  const catBonus = categoryWeight(m);
  const liveBonus = status.live ? 0.03 : 0.0;

  let conf;
  if (oA > 1 && oB > 1) {
    conf = 0.50 + (favProb - 0.5) * 1.20 + catBonus + liveBonus;
  } else {
    conf = 0.58 + catBonus;
  }

  if (status.live) conf += computeMomentum(m, favIsA);

  const surf = detectSurface(m);
  conf += surfaceAdj(surf);

  conf += timeToStartAdj(m, status);

  conf += driftGuardAdj(m, status, favIsA, favProb);

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
      surface: surf
    },
  };
}