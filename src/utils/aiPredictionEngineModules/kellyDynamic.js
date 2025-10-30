// src/utils/aiPredictionEngineModules/kellyDynamic.js
// v1.2 — dynamic Kelly sizing with volatility dampening, drift penalty,
// momentum boost AND adaptive caps (Phase 5)

export default function kellyDynamic({
  conf,
  odds,
  volatility = 0.5,   // 0..1 from volatilityScore
  capPct = 0.02,      // base hard cap on stake% (e.g., 2% bankroll)
  kellyFactor = 0.5,  // fraction of Kelly to use (0..1)
  drift = 0,          // market drift signal in [-1..+1]; negative = moving against us
  momentum = 0        // momentum signal in [-1..+1]; positive = tailwind for the pick
} = {}) {
  const p = clamp01(conf);
  const o = Number(odds);
  if (!Number.isFinite(o) || o <= 1) return zero();

  // 1) Classical Kelly
  const b = o - 1;
  const kelly = Math.max(0, (b * p - (1 - p)) / b);

  // 2) Volatility damp: v∈[0.3..0.8] → scale∈[0.95..0.55]
  const v = clamp01(volatility);
  const t = clamp01((v - 0.3) / 0.5);
  const volDamp = clamp(linearMap(0, 1, 0.95, 0.55, t), 0.55, 0.95);

  // 3) Drift penalty: if drift<0, shrink; if >0, tiny relief
  // drift ∈ [-1..+1] → scale ∈ [0.75..1.05]
  const d = clamp(drift, -1, 1);
  const driftScale = clamp(
    1 + d * 0.05 - Math.max(0, -d) * 0.25,
    0.70,
    1.05
  );

  // 4) Momentum boost: momentum ∈ [-1..+1] → scale ∈ [0.95..1.10]
  const m = clamp(momentum, -1, 1);
  const momScale = clamp(1 + m * 0.10, 0.95, 1.10);

  // 5) Compose
  const kAdj = kelly * volDamp * driftScale * momScale * clamp01(kellyFactor);

  // 6) Adaptive cap logic (Phase 5)
  // Start from the user/base cap (usually 0.02 = 2%)
  let adaptiveCap = Math.max(0, Number(capPct) || 0);

  // High volatility → shrink to 1%
  if (v > 0.75) {
    adaptiveCap = Math.min(adaptiveCap, 0.01);
  }

  // Market moving clearly against us → shrink to 0.8%
  if (d < -0.4) {
    adaptiveCap = Math.min(adaptiveCap, 0.008);
  }

  // Both bad → 0.5%
  if (v > 0.75 && d < -0.4) {
    adaptiveCap = Math.min(adaptiveCap, 0.005);
  }

  // 7) Soft floor: if we actually have a positive suggestion,
  // don't let it drop below 0.3% unless the cap itself is lower.
  const SOFT_FLOOR = 0.003; // 0.3%
  let fraction = clamp(round4(kAdj), 0, 1);

  if (fraction > 0 && fraction < SOFT_FLOOR) {
    fraction = SOFT_FLOOR;
  }

  const stakePct = round4(Math.min(fraction, adaptiveCap));

  return { fraction, stakePct };
}

// Helpers
function clamp01(x) {
  return clamp(Number(x) || 0, 0, 1);
}

function clamp(x, min, max) {
  const n = Number(x);
  if (!Number.isFinite(n)) return min;
  return n < min ? min : n > max ? max : n;
}

function linearMap(x0, x1, y0, y1, x) {
  return y0 + (y1 - y0) * ((x - x0) / (x1 - x0 + 1e-9));
}

function round4(x) {
  return Math.round((Number(x) || 0) * 1e4) / 1e4;
}

function zero() {
  return { fraction: 0, stakePct: 0 };
}