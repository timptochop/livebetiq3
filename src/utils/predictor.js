﻿/**
 * src/utils/predictor.js
 * v3.3-calibrated — pointContext + volatility-aware confidence + Dynamic Kelly stake
 * Single-module drop-in, no UI changes.
 */

// -------------------------
// Helpers (robust, no-crash)
// -------------------------
export function currentSetFromScores(m = {}) {
  const s = (m.status || m.set || "").toString().toLowerCase();
  if (s.includes("set 3")) return 3;
  if (s.includes("set 2")) return 2;
  if (s.includes("set 1")) return 1;
  if (Number.isFinite(m.setNum)) return m.setNum;
  return 0; // 0 => not started / unknown
}

function currentGameFromScores(players = []) {
  const a = players?.[0] || {};
  const b = players?.[1] || {};
  const gA = parseInt(a.games ?? a.g ?? a.currentGame ?? 0, 10) || 0;
  const gB = parseInt(b.games ?? b.g ?? b.currentGame ?? 0, 10) || 0;
  return { gA, gB, total: gA + gB, diff: Math.abs(gA - gB) };
}

function parsePointScore(raw = "") {
  const mapping = { "0": 0, "15": 1, "30": 2, "40": 3, "Ad": 4, "AD":4, "ad":4 };
  const parts = String(raw || "").split("-");
  if (parts.length !== 2) return [0, 0];
  const pA = mapping[parts[0].trim()] ?? 0;
  const pB = mapping[parts[1].trim()] ?? 0;
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

function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

function normalizeConf(c) {
  const min = 0.40, max = 0.90; // clamp window
  if (c <= min) return 0;
  if (c >= max) return 1;
  return (c - min) / (max - min);
}

function surfaceAdjust(surface = "", indoor = false) {
  const s = String(surface).toLowerCase();
  let adj = 0;
  if (s.includes("clay")) adj -= 0.05;
  if (s.includes("grass")) adj += 0.05;
  if (s.includes("hard")) adj += 0;
  if (indoor) adj += 0.03;
  return adj;
}

// -------------------------
// Volatility model (0..1)
// - υψηλό = αβέβαιο game state -> μειώνουμε confidence/Kelly
// -------------------------
function volatilityScore(ctx = {}) {
  const { gA=0, gB=0, total=0, diff=0, pointScore="" } = ctx;
  const [pA, pB] = parsePointScore(pointScore);

  // base vol per game window
  let vol;
  if (total <= 3)                vol = 0.65;           // πολύ νωρίς στο set
  else if (total <= 6)           vol = diff >= 2 ? 0.75 : 0.55; // early swing
  else if (total <= 9)           vol = diff >= 3 ? 0.60 : 0.45; // mid set
  else                           vol = 0.35;           // stabilized

  // point pressure: AD / 40-x αυξάνει volatility
  if (Math.abs(pA - pB) >= 2)    vol += 0.05;
  if (pA === 4 || pB === 4)      vol += 0.05;

  // clamp
  return Math.max(0, Math.min(1, Math.round(vol * 100) / 100));
}

// -------------------------
// Kelly Criterion
// -------------------------
function kellyFraction(conf, odds) {
  if (!Number.isFinite(odds) || odds <= 1) return 0;
  const b = odds - 1, p = conf, q = 1 - p;
  const fStar = (b * p - q) / b;
  return fStar > 0 ? round2(Math.min(fStar, 1)) : 0;
}

// -------------------------
// Core predictor (SET 2 only)
// -------------------------
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

  // Not live -> badge only
  if (!f.live) {
    const badge = f.setNum === 1 ? "SET 1" : f.setNum === 2 ? "SET 2" : f.setNum >= 3 ? "SET 3" : "START SOON";
    return decorate({ label: badge, conf: 0.0, tip: "", kellyFraction: 0 }, f, m);
  }

  // We only predict in SET 2
  if (f.setNum === 1)   return decorate({ label: "SET 1", conf: 0.0, tip: "", kellyFraction: 0 }, f, m);
  if (f.setNum >= 3)    return decorate({ label: "SET 3", conf: 0.0, tip: "", kellyFraction: 0 }, f, m);

  const { gA, gB, total, diff } = currentGameFromScores(m.players || []);
  if (total < 3)        return decorate({ label: "SET 2", conf: 0.0, tip: "", kellyFraction: 0 }, f, m);
  if (total > 6 || (gA >= 6 && gB >= 6))
                        return decorate({ label: "AVOID", conf: 0.0, tip: "", kellyFraction: 0 }, f, m);

  // Base linear model
  const w = [1.6, 0.9, 1.1, 0.3]; // [odds, momentum, drift, biasWeight]
  const b0 = -1.0;                 // bias

  const x0 = clampOdds(f.pOdds);
  const x1 = Number.isFinite(f.momentum) ? f.momentum : 0;
  const x2 = Number.isFinite(f.drift) ? f.drift : 0;
  let conf = sigmoid(w[0]*x0 + w[1]*x1 + w[2]*x2 + w[3] + b0);

  // Set-1 winner nudge
  const winner = previousSetWinner(m.players || []);
  if (winner === 1) conf += 0.05; else if (winner === 2) conf -= 0.05;

  // Drift nudge
  if (f.drift >  0.10) conf -= 0.05;
  if (f.drift < -0.10) conf += 0.05;

  // Surface nudge
  conf += surfaceAdjust(f.surface, f.indoor);

  // Point context nudge
  const [pA, pB] = parsePointScore(f.pointScore);
  if (pA - pB >= 2) conf += 0.05;
  if (pB - pA >= 2) conf -= 0.05;

  // Volatility-aware downscale
  const vol = volatilityScore({ gA, gB, total, diff, pointScore: f.pointScore });
  conf = conf * (1 - 0.25 * vol); // reduce up to 25% in high volatility

  // Normalize & clamp
  conf = normalizeConf(conf);
  conf = round2(Math.min(1, Math.max(0, conf)));

  // Labeling
  let label = "RISKY";
  if (conf >= 0.80) label = "SAFE";
  else if (conf < 0.65) label = "AVOID";

  // Kelly (volatility-adjusted)
  const rawKelly = kellyFraction(conf, f.pOdds);
  const kMult    = 1 - 0.50 * vol;          // cut up to -50% in high vol
  const kScaled  = round2(Math.max(0, rawKelly * kMult));

  const tip = makeTip(m, f);
  const out = decorate({ label, conf, tip, kellyFraction: kScaled }, f, m);

  // Debug table (no-crash)
  try {
    console.table([{
      matchId: m.id || "-",
      players: `${m?.players?.[0]?.name || "?"} vs ${m?.players?.[1]?.name || "?"}`,
      setNum: f.setNum, gA, gB, total, diff, pointScore: f.pointScore,
      odds: f.pOdds, momentum: f.momentum, drift: f.drift,
      surface: f.surface, vol, conf, label, kelly: kScaled
    }]);
  } catch (e) {}

  return out;
}

// -------------------------
// Internal utilities
// -------------------------
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
  return 1 - norm; // μικρό odds -> 1.0
}

function round2(x) { return Math.round(x * 100) / 100; }

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

// default export
export default function run(m = {}, features = {}) {
  return predictMatch(m, features);
}
