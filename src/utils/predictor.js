// src/utils/predictor.js
// v2.1 tuned: σταθερά exports + πιο “επιθετικά” weights ώστε να παράγει ξεκάθαρα SAFE/RISKY/AVOID και TIP.
// Μένουμε σε ένα αρχείο, καμία άλλη αλλαγή.

// --- optional logging (no-op αν δεν υπάρχει ή REACT_APP_LOG_PREDICTIONS!=1) ---
let logPrediction = () => {};
try {
  ({ logPrediction } = require("./predictionLogger"));
} catch (_) {}

// --- helpers ---
const num = (v, d = 0) => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : d;
};
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

const getPlayers = (m) => {
  const p1 =
    m?.players?.[0]?.name ||
    m?.home?.name ||
    m?.p1 || m?.player1 || m?.name1 || "Player A";
  const p2 =
    m?.players?.[1]?.name ||
    m?.away?.name ||
    m?.p2 || m?.player2 || m?.name2 || "Player B";
  return { p1, p2 };
};

function currentSetFromScores(m = {}) {
  const status = String(m?.status || "").toLowerCase();
  const m2 = status.match(/set\s*(\d+)/i);
  if (m2 && m2[1]) return num(m2[1], 0);
  if (status.includes("not started")) return 0;
  if (status.includes("finished") || status.includes("retired")) return 0;

  const setsRoot = ["s1", "s2", "s3", "s4", "s5"].filter((k) => {
    const v = m?.[k];
    return v !== undefined && v !== null && String(v).trim() !== "";
  }).length;
  if (setsRoot > 0) return setsRoot;

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

  return Math.max(p1Sets, p2Sets);
}

function buildFeatures(m = {}) {
  const pOdds1 = num(m?.pOdds1, num(m?.odds1, 0));
  const pOdds2 = num(m?.pOdds2, num(m?.odds2, 0));
  const prob1 =
    pOdds1 > 1 ? clamp01(1 / pOdds1) : pOdds1 > 0 && pOdds1 < 1 ? pOdds1 : 0.5;
  const prob2 =
    pOdds2 > 1 ? clamp01(1 / pOdds2) : pOdds2 > 0 && pOdds2 < 1 ? pOdds2 : 0.5;

  const momentum = clamp01(num(m?.momentum, 0.55)); // ελαφρά υπέρ φαβορί
  const drift = clamp01(num(m?.drift, 0.50));

  const setNum = num(m?.setNum, currentSetFromScores(m));
  const live = (() => {
    const s = String(m?.status || "").toLowerCase();
    if (!s) return setNum > 0 ? 1 : 0;
    if (s.includes("not started")) return 0;
    if (s.includes("finished") || s.includes("retired")) return 0;
    return 1;
  })();

  return { prob1, prob2, momentum, drift, setNum, live };
}

// πιο “επιθετικά” weights για καθαρότερες αποφάσεις
function scoreLinear(f) {
  const w = {
    prob1: 1.60,
    prob2: -1.40,
    momentum: 0.70,
    drift: 0.40,
    setFlag: 0.15,
    live: 0.25,
    bias: 0.05,
  };
  const z =
    w.bias +
    w.prob1 * f.prob1 +
    w.prob2 * f.prob2 +
    w.momentum * f.momentum +
    w.drift * f.drift +
    w.setFlag * (f.setNum > 0 ? 1 : 0) +
    w.live * f.live;

  return 1 / (1 + Math.exp(-z));
}

function labelFromConf(conf) {
  if (conf >= 0.86) return "SAFE";
  if (conf >= 0.70) return "RISKY";
  return "AVOID";
}

function predictMatch(m = {}) {
  const features = buildFeatures(m);
  const conf = scoreLinear(features);
  const label = labelFromConf(conf);

  const { p1, p2 } = getPlayers(m);
  const tipWinner = conf >= 0.50 ? p1 : p2;
  const tip = `${tipWinner} to win match`;

  const payload = { label, conf, tip, features };

  try {
    logPrediction({
      event: "prediction",
      model: "v2.1",
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