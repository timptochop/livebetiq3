// src/utils/predictor.js
// Lockdown+: minimal, defensive predictor with stable exports
// - exports: predictMatch, currentSetFromScores
// - zero-crash guards on missing data
// - optional logging via src/utils/predictionLogger.js (no-op αν λείπει ή είναι OFF)

let logPrediction = () => {};
try {
  // will be a no-op if REACT_APP_LOG_PREDICTIONS != "1"
  ({ logPrediction } = require("./predictionLogger"));
} catch (_) {
  // keep silent; logging is optional
}

// ---------- helpers ----------
const num = (v, d = 0) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Try to read players in many shapes: GoalServe, local mocks, etc.
const getPlayers = (m) => {
  const p1 =
    m?.players?.[0]?.name ||
    m?.home?.name ||
    m?.p1 ||
    m?.player1 ||
    m?.name1 ||
    "Player A";
  const p2 =
    m?.players?.[1]?.name ||
    m?.away?.name ||
    m?.p2 ||
    m?.player2 ||
    m?.name2 ||
    "Player B";
  return { p1, p2 };
};

// Infer live set number from score/status in a robust way
function currentSetFromScores(m = {}) {
  // Common GS fields: status text includes "Set 2", "Set 3" etc.
  const status = String(m?.status || "").toLowerCase();

  const setFromStatus = (() => {
    const m2 = status.match(/set\s*(\d+)/i);
    if (m2 && m2[1]) return num(m2[1], 0);
    if (status.includes("not started")) return 0;
    if (status.includes("finished") || status.includes("retired")) return 0; // treat as not-live
    return undefined;
  })();

  if (Number.isFinite(setFromStatus)) return setFromStatus;

  // Otherwise, count non-empty set strings s1..s5 either at root or per-player
  const setsRoot = ["s1", "s2", "s3", "s4", "s5"].filter((k) => {
    const v = m?.[k];
    return v !== undefined && v !== null && String(v).trim() !== "";
  }).length;

  if (setsRoot > 0) return setsRoot;

  // Per player arrays (GS often keeps s1..s5 on each player)
  const p1Sets =
    m?.players?.[0]
      ? ["s1", "s2", "s3", "s4", "s5"].filter((k) => {
          const v = m.players[0][k];
          return v !== undefined && v !== null && String(v).trim() !== "";
        }).length
      : 0;

  const p2Sets =
    m?.players?.[1]
      ? ["s1", "s2", "s3", "s4", "s5"].filter((k) => {
          const v = m.players[1][k];
          return v !== undefined && v !== null && String(v).trim() !== "";
        }).length
      : 0;

  const s = Math.max(p1Sets, p2Sets);
  return s; // 0..5
}

// Build compact features vector with sane defaults
function buildFeatures(m = {}) {
  // Pre-match odds (decimal) -> implied prob; fallbacks
  const pOdds1 = num(m?.pOdds1, num(m?.odds1, 0));
  const pOdds2 = num(m?.pOdds2, num(m?.odds2, 0));

  const prob1 =
    pOdds1 > 1 ? clamp01(1 / pOdds1) : pOdds1 > 0 && pOdds1 < 1 ? pOdds1 : 0.5;
  const prob2 =
    pOdds2 > 1 ? clamp01(1 / pOdds2) : pOdds2 > 0 && pOdds2 < 1 ? pOdds2 : 0.5;

  // Momentum / drift placeholders (0..1). If not available -> 0.5 (neutral)
  const momentum = clamp01(num(m?.momentum, 0.5));
  const drift = clamp01(num(m?.drift, 0.5));

  const setNum = num(m?.setNum, currentSetFromScores(m)); // 0 when pre
  const live = (() => {
    const s = String(m?.status || "").toLowerCase();
    if (!s) return setNum > 0 ? 1 : 0;
    if (s.includes("not started")) return 0;
    if (s.includes("finished") || s.includes("retired")) return 0;
    return 1;
  })();

  return {
    prob1,
    prob2,
    momentum,
    drift,
    setNum,
    live, // 0/1
  };
}

// ---------- model ----------
function scoreLinear(f) {
  // Simple, readable weights. Fine-tune σε επόμενα βήματα.
  const w = {
    prob1: 1.30, // prematch probability for P1
    prob2: -1.10, // penalize P2 probability
    momentum: 0.60,
    drift: 0.40,
    setNum: 0.10, // very mild
    live: 0.20,
    bias: -0.10,
  };

  const z =
    w.bias +
    w.prob1 * f.prob1 +
    w.prob2 * f.prob2 +
    w.momentum * f.momentum +
    w.drift * f.drift +
    w.setNum * (f.setNum > 0 ? 1 : 0) +
    w.live * f.live;

  // logistic -> confidence (0..1)
  const conf = 1 / (1 + Math.exp(-z));
  return conf;
}

function labelFromConf(conf) {
  if (conf >= 0.85) return "SAFE";
  if (conf >= 0.70) return "RISKY";
  return "AVOID";
}

// ---------- public API ----------
function predictMatch(m = {}) {
  const features = buildFeatures(m);
  const conf = scoreLinear(features);
  const label = labelFromConf(conf);

  const { p1, p2 } = getPlayers(m);
  // pick winner side by conf relative to 0.5
  const tipWinner = conf >= 0.5 ? p1 : p2;
  const tip = `${tipWinner} to win match`;

  const payload = {
    label,
    conf,
    tip,
    features,
  };

  // optional log (no-op unless REACT_APP_LOG_PREDICTIONS=1)
  try {
    logPrediction({
      event: "prediction",
      model: "v2",
      matchId: m?.id || m?.matchId || null,
      payload,
    });
  } catch (_) {}

  return payload;
}

module.exports = {
  predictMatch,
  currentSetFromScores,
};