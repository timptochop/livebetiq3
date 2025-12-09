// src/utils/analyzeMatch.js
const T = {
  MIN_ODDS: 1.5,
  CLAMP_UP: 0.06,
  CLAMP_DOWN: -0.05,
  SET2_TOTAL_MIN: 2,
  SET2_TOTAL_MAX: 7,
  SAFE_CONF: 0.66,
  MIN_PROB_SAFE: 0.5,
  MAX_SET2_DIFF_SAFE: 6,
  RISKY_MIN_CONF: 0.5,
  MIN_PROB_RISKY: 0.46,
  MAX_SET2_DIFF_RISKY: 7,
};

const DEFAULT_WEIGHTS = {
  ev: 0.3,
  confidence: 0.25,
  momentum: 0.15,
  drift: 0.1,
  surface: 0.1,
  form: 0.1,
};

const BOOST = {
  fixture: 0.018,
  fixtureHard: 0.035,
  momentumMult: 1.25,
  momentumMultFixture: 1.35,
  momentumCap: 0.075,
};

function getAdaptiveWeights() {
  if (
    typeof window !== "undefined" &&
    window.__LBQ_WEIGHTS__ &&
    typeof window.__LBQ_WEIGHTS__ === "object"
  ) {
    return {
      ev: Number(window.__LBQ_WEIGHTS__.ev || DEFAULT_WEIGHTS.ev),
      confidence: Number(
        window.__LBQ_WEIGHTS__.confidence || DEFAULT_WEIGHTS.confidence
      ),
      momentum: Number(
        window.__LBQ_WEIGHTS__.momentum || DEFAULT_WEIGHTS.momentum
      ),
      drift: Number(window.__LBQ_WEIGHTS__.drift || DEFAULT_WEIGHTS.drift),
      surface: Number(
        window.__LBQ_WEIGHTS__.surface || DEFAULT_WEIGHTS.surface
      ),
      form: Number(window.__LBQ_WEIGHTS__.form || DEFAULT_WEIGHTS.form),
    };
  }
  return DEFAULT_WEIGHTS;
}

const toNum = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
};

function pickTwoOdds(oddsObj = {}, nameA = "", nameB = "") {
  let oA = 0,
    oB = 0;
  if (oddsObj && typeof oddsObj === "object") {
    if (toNum(oddsObj.p1) > 1 && toNum(oddsObj.p2) > 1) {
      oA = toNum(oddsObj.p1);
      oB = toNum(oddsObj.p2);
    } else if (
      nameA &&
      nameB &&
      toNum(oddsObj[nameA]) > 1 &&
      toNum(oddsObj[nameB]) > 1
    ) {
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
      (m.players[0]?.name || m.players[0]?.["@name"] || "").trim() ||
        "Player A",
      (m.players[1]?.name || m.players[1]?.["@name"] || "").trim() ||
        "Player B",
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
  const live =
    s.includes("set") ||
    s.includes("live") ||
    s.includes("in play") ||
    s.includes("1st") ||
    s.includes("2nd");
  let setNum = 0;
  const mt = /set\s*(\d+)/i.exec(raw);
  if (mt && mt[1]) setNum = Number(mt[1]) || 0;
  const finished =
    s.includes("finished") ||
    s.includes("retired") ||
    s.includes("walkover") ||
    s.includes("walk over") ||
    s.includes("abandoned");
  const cancelled = s.includes("cancel") || s.includes("postpon");
  return { live, setNum, finished, cancelled };
}

function categoryWeight(m = {}) {
  const cat = (
    m.categoryName ||
    m.category ||
    m["@category"] ||
    ""
  )
    .toString()
    .toLowerCase();
  if (cat.includes("atp") || cat.includes("wta")) return 0.07;
  if (cat.includes("challenger")) return 0.03;
  if (cat.includes("itf")) return -0.05;
  return 0.0;
}

function readSetGames(p, idx) {
  const key = "s" + idx;
  if (!p) return null;
  const v = p[key];
  if (v !== undefined && v !== null && v !== "") return toNum(v);
  return null;
}

function currentSetPair(m, status) {
  if (!Array.isArray(m.players) || m.players.length < 2)
    return { ga: null, gb: null };
  const A = m.players[0] || {};
  const B = m.players[1] || {};
  const idx = status.setNum > 0 ? status.setNum : 1;
  const ga = readSetGames(A, idx);
  const gb = readSetGames(B, idx);
  return { ga, gb };
}

function computeMomentum(m, favIsA) {
  if (!Array.isArray(m.players) || m.players.length < 2) return 0;
  const A = m.players[0] || {};
  const B = m.players[1] || {};
  let setsCounted = 0,
    setsLeadA = 0,
    lastDiff = 0;
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
    m.surface,
    m.court,
    m.courtType,
    m.categoryName,
    m.league,
    m.tournament,
    m.info,
    m.meta,
  ]
    .filter(Boolean)
    .map((x) => String(x).toLowerCase())
    .join(" ");
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
  const dd = Number(md[1]);
  const mm = Number(md[2]) - 1;
  const yyyy = Number(md[3]);
  const hh = Number(mt[1]);
  const min = Number(mt[2]);
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

function set2WindowGuard(status, ga, gb) {
  if (status.setNum !== 2)
    return { pass: false, badge: `SET ${status.setNum || 1}` };
  if (ga === null || gb === null) return { pass: false, badge: `SET 2` };
  const total = (ga || 0) + (gb || 0);
  const isTB = ga >= 6 && gb >= 6;
  if (isTB) return { pass: false, badge: "AVOID" };
  if (total < T.SET2_TOTAL_MIN) return { pass: false, badge: "SET 2" };
  if (total > T.SET2_TOTAL_MAX) return { pass: false, badge: "AVOID" };
  return {
    pass: true,
    total,
    diff: Math.abs((ga || 0) - (gb || 0)),
    ga,
    gb,
  };
}

function volatilityClamp(confBase, confNow) {
  let d = confNow - confBase;
  if (d > T.CLAMP_UP) d = T.CLAMP_UP;
  if (d < T.CLAMP_DOWN) d = T.CLAMP_DOWN;
  return confBase + d;
}

function matchFixtureHit(m = {}, favName = "") {
  try {
    if (typeof window === "undefined") return null;
    const fx = window.__LBQ_FIXTURES__;
    if (!fx) return null;
    const matchId = m.id || m.matchId || m.uid || "";
    const title = m.name || "";
    const tour = m.tournament || m.categoryName || "";
    const lowerFav = favName ? favName.toLowerCase() : "";
    if (Array.isArray(fx)) {
      for (const item of fx) {
        if (!item) continue;
        const s = String(item).toLowerCase();
        if (
          (matchId && s.includes(String(matchId).toLowerCase())) ||
          (title && s.includes(String(title).toLowerCase())) ||
          (tour && s.includes(String(tour).toLowerCase())) ||
          (lowerFav && s.includes(lowerFav))
        ) {
          return { type: "list", raw: item };
        }
      }
    } else if (typeof fx === "object") {
      if (matchId && fx[matchId]) {
        return { type: "map", raw: fx[matchId] };
      }
    }
  } catch {}
  return null;
}

function fixtureLabelFromRaw(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes("safe")) return "SAFE";
  if (s.includes("risky")) return "RISKY";
  if (s.includes("avoid")) return "AVOID";
  if (s.includes("border")) return "BORDER";
  return null;
}

export default function analyzeMatch(m = {}, extra = {}) {
  const weights = getAdaptiveWeights();
  const [pA, pB] = parsePlayers(m);
  const status = parseStatus(m);
  const oddsObj = m.odds || m.market || m.oddsFT || {};

  const extraDrift =
    typeof extra.drift === "number" && Number.isFinite(extra.drift)
      ? extra.drift
      : 0;
  const extraPOdds =
    extra && Number(extra.pOdds) > 1 ? Number(extra.pOdds) : 0;
  const extraFavName =
    extra && typeof extra.favName === "string"
      ? extra.favName.trim()
      : "";

  const { oA, oB } = pickTwoOdds(oddsObj, pA, pB);
  const haveOdds = oA > 1 && oB > 1;

  if (!haveOdds) {
    if (!status.live) {
      return {
        label: "UPCOMING",
        conf: 0,
        kellyLevel: "LOW",
        tip: "",
        features: { setNum: status.setNum || 0, live: 0, drift: extraDrift },
      };
    }
    if (status.setNum === 1) {
      return {
        label: "SET 1",
        conf: 0,
        kellyLevel: "LOW",
        tip: "",
        features: { setNum: 1, live: 1, drift: extraDrift },
      };
    }
    if (status.setNum >= 3) {
      return {
        label: "SET 3",
        conf: 0,
        kellyLevel: "LOW",
        tip: "",
        features: { setNum: status.setNum, live: 1, drift: extraDrift },
      };
    }
    const { ga, gb } = currentSetPair(m, status);
    const win = set2WindowGuard(status, ga, gb);
    const badge = win.pass ? "AVOID" : win.badge;
    return {
      label: badge,
      conf: 0,
      kellyLevel: "LOW",
      tip: "",
      features: {
        setNum: status.setNum,
        live: 1,
        drift: extraDrift,
      },
    };
  }

  let { pa, pb } = implied(oA, oB);
  const favIsA = pa >= pb;
  let favName = favIsA ? pA : pB;
  if (extraFavName) favName = extraFavName;
  const favProb = favIsA ? pa : pb;
  const favOdds = favIsA ? oA : oB;

  const fixtureHit = matchFixtureHit(m, favName);
  const fixtureLabel = fixtureHit ? fixtureLabelFromRaw(fixtureHit.raw) : null;

  if (!status.live) {
    return {
      label: fixtureLabel ? fixtureLabel : "UPCOMING",
      conf: fixtureLabel === "SAFE" ? 0.7 : 0,
      kellyLevel: fixtureLabel === "SAFE" ? "MED" : "LOW",
      tip: fixtureLabel === "SAFE" ? favName + " to win match" : "",
      features: {
        setNum: status.setNum || 0,
        live: 0,
        fixture: fixtureHit ? fixtureHit.raw : null,
        drift: extraDrift,
        pOddsSingle: extraPOdds,
      },
    };
  }

  if (status.setNum === 1) {
    return {
      label: fixtureLabel ? fixtureLabel : "SET 1",
      conf: fixtureLabel === "SAFE" ? 0.7 : 0,
      kellyLevel: fixtureLabel === "SAFE" ? "MED" : "LOW",
      tip: fixtureLabel === "SAFE" ? favName + " to win match" : "",
      features: {
        setNum: 1,
        live: 1,
        fixture: fixtureHit ? fixtureHit.raw : null,
        drift: extraDrift,
        pOddsSingle: extraPOdds,
      },
    };
  }

  if (status.setNum >= 3) {
    return {
      label: fixtureLabel ? fixtureLabel : "SET 3",
      conf: fixtureLabel === "SAFE" ? 0.7 : 0,
      kellyLevel: fixtureLabel === "SAFE" ? "MED" : "LOW",
      tip: fixtureLabel === "SAFE" ? favName + " to win match" : "",
      features: {
        setNum: status.setNum,
        live: 1,
        fixture: fixtureHit ? fixtureHit.raw : null,
        drift: extraDrift,
        pOddsSingle: extraPOdds,
      },
    };
  }

  const { ga, gb } = currentSetPair(m, status);
  const win = set2WindowGuard(status, ga, gb);
  if (!win.pass) {
    return {
      label: fixtureLabel ? fixtureLabel : win.badge,
      conf: fixtureLabel === "SAFE" ? 0.7 : 0,
      kellyLevel: fixtureLabel === "SAFE" ? "MED" : "LOW",
      tip: fixtureLabel === "SAFE" ? favName + " to win match" : "",
      features: {
        setNum: status.setNum,
        live: 1,
        fixture: fixtureHit ? fixtureHit.raw : null,
        drift: extraDrift,
        pOddsSingle: extraPOdds,
      },
    };
  }

  const catBonus = categoryWeight(m);
  const liveBonus = 0.03;
  const confBase =
    0.5 + (favProb - 0.5) * 1.2 + catBonus + liveBonus;
  let conf = confBase;

  const isCleanSet2 = win.total >= 3 && win.total <= 5;
  const favLeadingNow = favIsA
    ? (win.ga || 0) >= (win.gb || 0)
    : (win.gb || 0) >= (win.ga || 0);

  const momentumRawBase = computeMomentum(m, favIsA);
  let momentumRaw = momentumRawBase;
  if (momentumRaw > 0 && isCleanSet2 && favLeadingNow) {
    const mult =
      fixtureLabel === "SAFE"
        ? BOOST.momentumMultFixture
        : BOOST.momentumMult;
    momentumRaw = momentumRaw * mult;
    if (momentumRaw > BOOST.momentumCap) momentumRaw = BOOST.momentumCap;
  }

  const momentumWeighted = momentumRaw * weights.momentum;
  const surf = detectSurface(m);
  const surfaceRaw = surfaceAdj(surf);
  const surfaceWeighted = surfaceRaw * weights.surface;
  const timeAdjRaw = timeToStartAdj(m, status);
  const timeWeighted = timeAdjRaw * weights.form;
  const fixtureWeighted = fixtureLabel ? BOOST.fixtureHard : BOOST.fixture;
  const driftWeighted = extraDrift * (weights.drift || 0);

  conf += momentumWeighted;
  conf += surfaceWeighted;
  conf += timeWeighted;
  conf += fixtureWeighted;
  conf += driftWeighted;

  if (
    catBonus >= 0.07 &&
    favLeadingNow &&
    win.total >= 4 &&
    win.total <= 5
  ) {
    conf += 0.01 * weights.confidence;
  }

  const confFinal = Math.max(
    0.51,
    Math.min(0.95, volatilityClamp(confBase, conf))
  );
  const minOddsOk = Number.isFinite(favOdds) && favOdds >= T.MIN_ODDS;

  const safeProbOk = favProb >= T.MIN_PROB_SAFE;
  const safeDiffOk = (win.diff || 0) <= T.MAX_SET2_DIFF_SAFE;
  const safeAll =
    favLeadingNow &&
    minOddsOk &&
    safeProbOk &&
    safeDiffOk &&
    confFinal >= T.SAFE_CONF;

  const withinOneGameBehind =
    !favLeadingNow && Math.abs((win.ga || 0) - (win.gb || 0)) === 1;
  const riskyProbOk = favProb >= T.MIN_PROB_RISKY;
  const riskyDiffOk = (win.diff || 0) <= T.MAX_SET2_DIFF_RISKY;
  const riskyLeadOk = favLeadingNow || withinOneGameBehind;
  const riskyAll =
    riskyLeadOk &&
    minOddsOk &&
    riskyProbOk &&
    riskyDiffOk &&
    confFinal >= T.RISKY_MIN_CONF;

  let label = "AVOID";
  let tip = "";

  if (fixtureLabel === "SAFE") {
    label = "SAFE";
    tip = favName + " to win match";
  } else if (fixtureLabel === "RISKY") {
    label = "RISKY";
  } else if (fixtureLabel === "AVOID") {
    label = "AVOID";
  } else if (fixtureLabel === "BORDER") {
    label = safeAll ? "SAFE" : "RISKY";
  } else {
    if (safeAll) {
      label = "SAFE";
      tip = favName + " to win match";
    } else if (riskyAll) {
      label = "RISKY";
    } else {
      label = "AVOID";
    }
  }

  const kellyLevel =
    confFinal >= 0.9 ? "HIGH" : confFinal >= 0.8 ? "MED" : "LOW";

  try {
    if (process?.env?.REACT_APP_LOG_PREDICTIONS === "1") {
      console.table([
        {
          label,
          conf: +confFinal.toFixed(3),
          favProb: +favProb.toFixed(3),
          favOdds: +favOdds.toFixed(2),
          set2Total: win.total,
          set2Diff: win.diff,
          favLeading: favLeadingNow ? 1 : 0,
          catBonus: +catBonus.toFixed(3),
          surface: surf || "-",
          fixture: fixtureHit ? fixtureHit.raw : null,
          fixtureLabel: fixtureLabel || null,
          fixtureBoost: +fixtureWeighted.toFixed(3),
          momentumBase: +momentumRawBase.toFixed(3),
          momentumUsed: +momentumRaw.toFixed(3),
          drift: +extraDrift.toFixed(4),
          driftWeighted: +driftWeighted.toFixed(4),
          weights,
        },
      ]);
    }
  } catch (_) {}

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
      set2Diff: win.diff,
      fixture: fixtureHit ? fixtureHit.raw : null,
      fixtureLabel: fixtureLabel || null,
      fixtureBoost: fixtureWeighted,
      momentumBase: momentumRawBase,
      momentumUsed: momentumRaw,
      drift: extraDrift,
      driftWeighted,
      pOddsSingle: extraPOdds,
      weightsSource:
        typeof window !== "undefined" && window.__LBQ_WEIGHTS__
          ? "adaptive"
          : "default",
    },
  };
}