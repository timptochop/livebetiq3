// src/utils/aiPredictionEngineModules/kellyDynamic.js
// v1.1 — dynamic Kelly sizing with volatility dampening, drift penalty, momentum boost

export default function kellyDynamic({
  conf,
  odds,
  volatility = 0.5,   // 0..1 from volatilityScore
  capPct = 0.02,      // hard cap on stake% (e.g., 2% bankroll)
  kellyFactor = 0.5,  // fraction of Kelly to use (0..1)
  drift = 0,          // market drift signal in [-1..+1]; negative = moving against us
  momentum = 0        // momentum signal in [-1..+1]; positive = tailwind for the pick
} = {}) {
  const p = clamp01(conf);
  const o = Number(odds);
  if (!Number.isFinite(o) || o <= 1) return zero();

  // Classical Kelly
  const b = o - 1;
  const kelly = Math.max(0, (b * p - (1 - p)) / b);

  // Volatility damp: map v∈[0.3..0.8] → scale∈[0.95..0.55]
  const v = clamp01(volatility);
  const t = clamp01((v - 0.3) / 0.5);
  const volDamp = clamp(linearMap(0, 1, 0.95, 0.55, t), 0.55, 0.95);

  // Drift penalty: if drift<0, shrink; if >0, tiny relief (conservative)
  // drift ∈ [-1..+1] → scale ∈ [0.75..1.05], capped
  const d = clamp(drift, -1, 1);
  const driftScale = clamp(1 + d * 0.05 - Math.max(0, -d) * 0.25, 0.75, 1.05);

  // Momentum boost: small positive bump when momentum>0
  // momentum ∈ [-1..+1] → scale ∈ [0.95..1.10]
  const m = clamp(momentum, -1, 1);
  const momScale = clamp(1 + m * 0.10, 0.95, 1.10);

  // Compose
  const kAdj = kelly * volDamp * driftScale * momScale * clamp01(kellyFactor);

  const fraction = clamp(round4(kAdj), 0, 1);
  const stakePct = round4(Math.min(fraction, Math.max(0, Number(capPct) || 0)));

  return { fraction, stakePct };
}

// Helpers
function clamp01(x) { return clamp(Number(x) || 0, 0, 1); }
function clamp(x, min, max) {
  const n = Number(x);
  if (!Number.isFinite(n)) return min;
  return n < min ? min : n > max ? max : n;
}
function linearMap(x0, x1, y0, y1, x) { return y0 + (y1 - y0) * ((x - x0) / (x1 - x0)); }
function round4(x) { return Math.round((Number(x) || 0) * 1e4) / 1e4; }
function zero() { return { fraction: 0, stakePct: 0 }; }