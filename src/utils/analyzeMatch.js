// src/utils/analyzeMatch.js
// v3.9-open — πιο χαλαρά thresholds για να εμφανιστούν περισσότερα SAFE/RISKY
// Κρατάμε SET-2 window, αλλά total games 2..7 (χωρίς tiebreak)

const T = {
  // Πιο “ανοιχτά” νούμερα:
  MIN_ODDS: 1.40,      // πριν 1.50 → επιτρέπουμε λίγο χαμηλότερες αποδόσεις
  MIN_PROB: 0.47,      // πριν 0.50 → πιο χαλαρό
  MAX_SET2_DIFF: 6,    // πριν 5 → δέχεται πιο “ανοικτά” set 2
  SAFE_CONF: 0.70,     // πριν 0.78 → αρκετά χαμηλότερο για να δούμε SAFE

  // band για RISKY (επίσης χαμηλότερο):
  RISKY_MIN_CONF: 0.58,

  // σταθεροποίηση διακύμανσης (λίγο πιο “ελεύθερη” προς τα πάνω)
  CLAMP_UP: 0.08,
  CLAMP_DOWN: -0.06
};

const toNum = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

function pickTwoOdds(oddsObj = {}, nameA = "", nameB = "") {
  let oA = 0, oB = 0;
  if (oddsObj && typeof oddsObj === "object") {
    if (toNum(oddsObj.p1) > 1 && toNum(oddsObj.p2) > 1) {
      oA = toNum(oddsObj.p1); oB = toNum(oddsObj.p2);
    } else if (nameA && nameB && toNum(oddsObj[nameA]) > 1 && toNum(oddsObj[nameB]) > 1) {
      oA = toNum(oddsObj[nameA]); oB = toNum(oddsObj[nameB]);
    } else {
      const vals = Object.values(oddsObj).map(toNum).filter(v => v > 1);
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
      (m.players[0]?.name || m.players[0]?.["@name"] || "").trim() || "Player A",
      (m.players[1]?.name || m.players[1]?.["@name"] || "").trim() || "Player B",
    ];
  }
  if (typeof m.name === "string" && m.name.includes(" vs ")) {
    const [a, b] = m.name.split(" vs ");
    return [(a || "").trim() || "Player A", (b || "").trim() || "Player B"];
  }
  return ["Player A", "Player B"];
}

function parseStatus(m = {}) {
  const raw = String(m.status || m["@status"] || "");
  const s = raw.toLowerCase();
  const live = s.includes("set") || s.includes("live") || s.includes("in play") || s.includes("1st") || s.includes("2nd");
  let setNum = 0; const mt = /set\s*(\d+)/i.exec(raw); if (mt && mt[1]) setNum = Number(mt[1]) || 0;
  const finished = s.includes("finished") || s.includes("retired") || s.includes("walkover") || s.includes("walk over") || s.includes("abandoned");
  const cancelled = s.includes("cancel") || s.includes("postpon");
  return { live, setNum, finished, cancelled };
}

function categoryWeight(m = {}) {
  const cat = (m.categoryName || m.category || m["@category"] || "").toString().toLowerCase();
  if (cat.includes("atp") || cat.includes("wta")) return 0.07;
  if (cat.includes("challenger")) return 0.03;
  if (cat.includes("itf")) return -0.05;
  return 0.0;
}

function readSetGames(p, idx) {
  const key = "s" + idx; if (!p) return null; const v = p[key];
  if (v !== undefined && v !== null && v !== "") return toNum(v);
  return null;
}

function currentSetPair(m, status) {
  if (!status.live || !Array.isArray(m.players) || m.players.length < 2)
    return { ga: null, gb: null };
  const A = m.players[0] || {}, B = m.players[1] || {};
  const idx = status.setNum > 0 ? status.setNum : 1;
  const ga = readSetGames(A, idx), gb = readSetGames(B, idx);
  return { ga, gb };
}

function computeMomentum(m, favIsA) {
  if (!Array.isArray(m.players) || m.players.length < 2) return 0;
  const A = m.players[0] || {}, B = m.players[1] || {};
  let setsCounted = 0, setsLeadA = 0, lastDiff = 0;
  for (let i = 1; i <= 5; i++) {
    const ga = readSetGames(A, i), gb = readSetGames(B, i);
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
  const fields = [m.surface, m.court, m.courtType, m.categoryName, m.league, m.tournament, m.info, m.meta]
    .filter(Boolean).map(x => String(x).toLowerCase()).join(" ");
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
  const d = String(m.date || m["@date"] || "").trim();
  const t = String(m.time || m["@time"] || "").trim();
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
  const ts = parseStartTs(m); if (!ts) return 0;
  const diffMin = Math.round((ts - Date.now()) / 60000);
  if (diffMin <= 0) return 0.005;
  if (diffMin <= 120) return 0.01;
  if (diffMin <= 720) return 0.0;
  if (diffMin <= 1440) return -0.01;
  return -0.02;
}

// Ανοίγουμε το SET-2 παράθυρο: total games 2..7 (όχι tie-break)
function set2WindowGuard(status, ga, gb) {
  if (status.setNum !== 2) return { pass: false, badge: `SET ${status.setNum || 1}` };
  if (ga === null || gb === null) return { pass: false, badge: `SET 2` };
  const total = (ga || 0) + (gb || 0);
  const tieBreak = (ga >= 6 && gb >= 6);
  if (tieBreak) return { pass: false, badge: 'AVOID' };
  if (total < 2) return { pass: false, badge: 'SET 2' };
  if (total > 7) return { pass: false, badge: 'AVOID' };
  return { pass: true, total, diff: Math.abs((ga || 0) - (gb || 0)), ga, gb };
}

function volatilityClamp(confBase, confNow) {
  let d = confNow - confBase;
  if (d > T.CLAMP_UP) d = T.CLAMP_UP;
  if (d < T.CLAMP_DOWN) d = T.CLAMP_DOWN;
  return confBase + d;
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
  const favOdds = favIsA ? oA : oB;

  // Early guards
  if (!status.live) return { label: "UPCOMING", conf: 0, kellyLevel: "LOW", tip: "", features: { setNum: status.setNum || 0, live: 0 } };
  if (status.setNum === 1) return { label: "SET 1", conf: 0, kellyLevel: "LOW", tip: "", features: { setNum: 1, live: 1 } };
  if (status.setNum >= 3) return { label: "SET 3", conf: 0, kellyLevel: "LOW", tip: "", features: { setNum: status.setNum, live: 1 } };

  // SET 2 window
  const { ga, gb } = currentSetPair(m, status);
  const win = set2WindowGuard(status, ga, gb);
  if (!win.pass)
    return { label: win.badge, conf: 0, kellyLevel: "LOW", tip: "", features: { setNum: status.setNum, live: 1 } };

  // Base confidence
  const catBonus = categoryWeight(m);
  const liveBonus = 0.03;
  const confBase = (oA > 1 && oB > 1)
    ? (0.50 + ((favProb - 0.5) * 1.20) + catBonus + liveBonus)
    : (0.58 + catBonus);
  let conf = confBase;

  // Momentum & context
  conf += computeMomentum(m, favIsA);
  const surf = detectSurface(m); conf += surfaceAdj(surf);
  conf += timeToStartAdj(m, status);

  // Στοχευμένο μικρό boost όταν έχει νόημα:
  const favLeadingNow = favIsA ? ((win.ga || 0) >= (win.gb || 0)) : ((win.gb || 0) >= (win.ga || 0));
  if ((catBonus >= 0.07) && favLeadingNow && win.total >= 3 && win.total <= 6) {
    conf += 0.012; // λίγο μεγαλύτερο boost από v3.8
  }

  // Clamp & bounds
  const confFinal = Math.max(0.50, Math.min(0.97, volatilityClamp(confBase, conf)));

  // Precision filters (πιο χαλαρά)
  const favLeading = favLeadingNow;
  const oddsOk = Number.isFinite(favOdds) && favOdds >= T.MIN_ODDS;
  const probOk = favProb >= T.MIN_PROB;
  const diffOk = win.diff <= T.MAX_SET2_DIFF;

  // Labeling
  let label = 'AVOID';
  let tip = '';

  if (oddsOk && probOk && favLeading && diffOk) {
    if (confFinal >= T.SAFE_CONF) {
      label = 'SAFE';
      tip = `${favName} to win match`;
    } else if (confFinal >= T.RISKY_MIN_CONF && confFinal < T.SAFE_CONF) {
      label = 'RISKY';
      tip = '';
    } else {
      label = 'AVOID';
    }
  } else {
    label = 'AVOID';
  }

  const kellyLevel = confFinal >= 0.90 ? 'HIGH' : confFinal >= 0.78 ? 'MED' : 'LOW';

  // Optional debug
  try {
    if (process?.env?.REACT_APP_LOG_PREDICTIONS === '1') {
      // eslint-disable-next-line no-console
      console.table([{
        label, conf: +confFinal.toFixed(3),
        favProb: +favProb.toFixed(3),
        favOdds: +(+favOdds || 0).toFixed(2),
        set2Total: win.total, set2Diff: win.diff,
        catBonus: +catBonus.toFixed(3), surface: surf || '-'
      }]);
    }
  } catch {}

  return {
    label,
    conf: confFinal,
    kellyLevel,
    tip,
    features: {
      pOdds: { a: oA, b: oB },
      favName,
      favProb,
      favOdds,
      setNum: status.setNum,
      live: status.live ? 1 : 0,
      catBonus,
      surface: surf,
      set2Total: win.total,
      set2Diff: win.diff
    }
  };
}