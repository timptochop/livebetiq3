// src/utils/aiPredictionEngineModules/kellyDynamic.js
// v1.0 — dynamic Kelly sizing with volatility dampening

export default function kellyDynamic({ conf, odds, volatility = 0.5, capPct = 0.02 } = {}) {
  const p = clamp01(conf);
  if (!Number.isFinite(odds) || odds <= 1) return zero();

  const b = odds - 1;
  const base = (b * p - (1 - p)) / b;      // classical Kelly
  const k = Math.max(0, base);             // clip negatives to 0

  // Volatility dampening: 0.3..0.8 -> scale 0.85..0.55 (πιο μικρή θέση όταν έχει ένταση)
  const damp = 0.95 - (volatility - 0.3) * (0.40 / 0.5); // map 0.3→0.95, 0.8→0.55
  const frac = round2(Math.max(0, Math.min(1, k * damp)));

  // Προτεινόμενη θέση ως % bankroll με ανώτατο cap (default 2%)
  const stakePct = round2(Math.min(frac, capPct));

  return { fraction: frac, stakePct };
}

function clamp01(x) { return Math.min(1, Math.max(0, Number(x) || 0)); }
function round2(x)  { return Math.round(x * 100) / 100; }
function zero()     { return { fraction: 0, stakePct: 0 }; }