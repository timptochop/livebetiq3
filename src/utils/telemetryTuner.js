// src/utils/telemetryTuner.js
const KEY = "aiTuner.v1";
const MIN_SEEN = 20;

function safeLS() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function load() {
  const ls = safeLS();
  if (!ls) return {};
  try {
    const raw = ls.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(data) {
  const ls = safeLS();
  if (!ls) return;
  try {
    ls.setItem(KEY, JSON.stringify(data));
  } catch {}
}

function ctxKey(ctx) {
  const level = ctx?.level || "DEFAULT";
  const surface = ctx?.surface || "unknown";
  return `${level}|${surface}`;
}

export function recordDecision(ctx, label) {
  const data = load();
  const k = ctxKey(ctx);
  data[k] = data[k] || { seen: 0, safe: 0, risky: 0, avoid: 0, updatedAt: 0 };
  const b = data[k];
  b.seen += 1;
  if (label === "SAFE") b.safe += 1;
  else if (label === "RISKY") b.risky += 1;
  else b.avoid += 1;
  b.updatedAt = Date.now();
  save(data);
}

export function getNudges(ctx) {
  const data = load();
  const k = ctxKey(ctx);
  const b = data[k] || { seen: 0, safe: 0, risky: 0, avoid: 0 };
  if (b.seen < MIN_SEEN) return { safeAdj: 0, riskyAdj: 0 };

  const safeRate = b.safe / b.seen; // 0..1
  const target = 0.22; // desired SAFE share
  let delta = 0;

  if (safeRate > 0.45) delta = +0.025;
  else if (safeRate > 0.35) delta = +0.015;
  else if (safeRate > 0.28) delta = +0.008;
  else if (safeRate < 0.10) delta = -0.025;
  else if (safeRate < 0.15) delta = -0.015;
  else if (safeRate < 0.18) delta = -0.008;
  else delta = 0;

  // Clamp
  const safeAdj = Math.max(-0.03, Math.min(0.03, delta));
  const riskyAdj = Math.max(-0.02, Math.min(0.02, delta * 0.7));
  return { safeAdj, riskyAdj };
}

// Optional helper to inspect tuner state in console
export function _debugDump() {
  return load();
}