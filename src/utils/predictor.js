// src/utils/predictor.js
// v3.0-ppMomentum — adds point-by-point momentum feature

export function currentSetFromScores(m = {}) {
  const s = (m.status || m.set || "").toString().toLowerCase();
  if (s.includes("set 3")) return 3;
  if (s.includes("set 2")) return 2;
  if (s.includes("set 1")) return 1;
  if (Number.isFinite(m.setNum)) return m.setNum;
  return 0;
}

function currentGameFromScores(players = []) {
  const a = players?.[0] || {};
  const b = players?.[1] || {};
  const gA = parseInt(a.games ?? a.g ?? a.currentGame ?? 0, 10) || 0;
  const gB = parseInt(b.games ?? b.g ?? b.currentGame ?? 0, 10) || 0;
  return { gA, gB, total: gA + gB };
}

function parsePointScore(raw = "") {
  const mapping = { "0": 0, "15": 1, "30": 2, "40": 3, "Ad": 4 };
  const parts = raw.split("-");
  if (parts.length !== 2) return [0, 0];
  const pA = mapping[parts[0]] ?? 0;
  const pB = mapping[parts[1]] ?? 0;
  return [pA, pB];
}

function previousSetWinner(players = []) {
  const a = players?.[0] || {};
  const b = players?.[1] || {};
  const s1 = parseInt(a.s1 ?? 0, 10) || 0;
  const s2 = parseInt(b.s1 ?? 0, 10) || 0;
  if (s1 === s2) return 0;
  return s1 > s2 ? 1 : 2;
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

function normalizeConf(c) {
  const min = 0.4, max = 0.9;
  if (c <= min) return 0;
  if (c >= max) return 1;
  return (c - min) / (max - min);
}

function surfaceAdjust(surface = "", indoor = false) {
  const s = surface.toLowerCase();
  let adj = 0;
  if (s.includes("clay")) adj -= 0.05;
  if (s.includes("grass")) adj += 0.05;
  if (s.includes("hard")) adj += 0;
  if (indoor) adj += 0.03;
  return adj;
}

export function predictMatch(m = {}, featuresIn = {}) {
  const f = {
    pOdds: featuresIn.pOdds ?? m.pOdds ?? null,
    momentum: featuresIn.momentum ?? m.momentum ?? 0,
    drift: featuresIn.drift ?? m.drift ?? 0,
    live: featuresIn.live ?? m.live ?? false,
    setNum: featuresIn.setNum ?? currentSetFromScores(m),
    surface: m.categoryName || m.surface || "",
    indoor: /indoor/i.test(m.categoryName || m.surface || ""),
    pointScore: m.pointScore || "",
    ...featuresIn
  };

  if (!f.live) {
    const badge = f.setNum === 1 ? "SET 1" : f.setNum === 2 ? "SET 2" : f.setNum >= 3 ? "SET 3" : "START SOON";
    return decorate({ label: badge, conf: 0.0, tip: "", kellyLevel: "LOW" }, f, m);
  }

  if (f.setNum === 1) {
    return decorate({ label: "SET 1", conf: 0.0, tip: "", kellyLevel: "LOW" }, f, m);
  }
  if (f.setNum >= 3) {
    return decorate({ label: "SET 3", conf: 0.0, tip: "", kellyLevel: "LOW" }, f, m);
  }

  const { gA, gB, total } = currentGameFromScores(m.players || []);
  if (total < 3) {
    return decorate({ label: "SET 2", conf: 0.0, tip: "", kellyLevel: "LOW" }, f, m);
  }
  if (total > 6 || (gA >= 6 && gB >= 6)) {
    return decorate({ label: "AVOID", conf: 0.0, tip: "", kellyLevel: "LOW" }, f, m);
  }

  const w = [1.6, 0.9, 1.1, 0.3];
  const b = -1.0;
  const x0 = clampOdds(f.pOdds);
  const x1 = Number.isFinite(f.momentum) ? f.momentum : 0;
  const x2 = Number.isFinite(f.drift) ? f.drift : 0;
  const z  = w[0]*x0 + w[1]*x1 + w[2]*x2 + w[3] + b;
  let conf = sigmoid(z);

  const winner = previousSetWinner(m.players || []);
  if (winner === 1) conf += 0.05;
  else if (winner === 2) conf -= 0.05;

  if (f.drift > 0.10) conf -= 0.05;
  if (f.drift < -0.10) conf += 0.05;

  conf += surfaceAdjust(f.surface, f.indoor);

  // Point-by-point momentum
  const [pA, pB] = parsePointScore(f.pointScore);
  if (pA - pB >= 2) conf += 0.05;
  if (pB - pA >= 2) conf -= 0.05;

  conf = normalizeConf(conf);
  conf = round2(Math.min(1, Math.max(0, conf)));

  let label = "RISKY";
  if (conf >= 0.80) label = "SAFE";
  else if (conf < 0.65) label = "AVOID";

  const tip = makeTip(m, f);
  const kellyLevel = conf >= 0.80 ? "HIGH" : conf >= 0.65 ? "MED" : "LOW";

  const out = decorate({ label, conf, tip, kellyLevel }, f, m);

  // Debug logs
  try {
    console.table([{
      matchId: m.id || "-",
      players: `${m?.players?.[0]?.name || "?"} vs ${m?.players?.[1]?.name || "?"}`,
      setNum: f.setNum,
      pointScore: f.pointScore,
      odds: f.pOdds,
      momentum: f.momentum,
      drift: f.drift,
      surface: f.surface,
      conf,
      label,
      tip
    }]);
  } catch(e) {}

  return out;
}

function decorate(out, features, m) {
  out.features = {
    ...features,
    live: features.live ? 1 : 0,
    setNum: features.setNum ?? currentSetFromScores(m),
  };
  return out;
}

function clampOdds(v) {
  if (!Number.isFinite(v)) return 0.5;
  const min = 1.1, max = 3.0;
  const t = Math.max(min, Math.min(max, v));
  const norm = (t - min) / (max - min);
  return 1 - norm;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function makeTip(m = {}, f = {}) {
  const pA = m?.players?.[0]?.name || m?.home?.name || firstFromName(m?.name, 0) || "Player A";
  const pB = m?.players?.[1]?.name || m?.away?.name || firstFromName(m?.name, 1) || "Player B";
  if (Number.isFinite(f.pOdds)) {
    return f.pOdds <= 1.75 ? `TIP: ${pA} to win match` : `TIP: ${pB} to win match`;
  }
  if ((f.momentum ?? 0) >= 0) return `TIP: ${pA} to win match`;
  return `TIP: ${pB} to win match`;
}

function firstFromName(full, index) {
  if (!full || typeof full !== "string") return null;
  const vs = full.split(" vs ");
  if (vs.length !== 2) return null;
  return vs[index]?.trim() || null;
}

export default function run(m = {}, features = {}) {
  return predictMatch(m, features);
}