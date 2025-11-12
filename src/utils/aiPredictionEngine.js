// src/utils/aiPredictionEngine.js
// v3.3b-wire — Stable adapter + volatility fallback with diagnostics & safe baseline.

import aiEngineV2 from "./aiEngineV2";
import volatilityScore from "../aiPredictionEngineModules/volatilityScore";
import { getNudges, recordDecision } from "../telemetryTuner"; // safe no-op if not present

// ----------------- helpers -----------------
function isFiniteNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}
function clamp(n, min, max) {
  if (!isFiniteNum(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}
function buildVolatilityCtx(match = {}) {
  let setIdx = 0;

  const m = match || {};
  const live = m.live || m.status || m.score || {};

  if (isFiniteNum(m.currentSet)) {
    setIdx = clamp(Number(m.currentSet) - 1, 0, 2);
  } else if (isFiniteNum(live.currentSet)) {
    setIdx = clamp(Number(live.currentSet) - 1, 0, 2);
  } else if (Array.isArray(m.sets)) {
    setIdx = clamp(m.sets.length - 1, 0, 2);
  }

  let games = [];
  if (Array.isArray(m.games)) games = m.games;
  else if (Array.isArray(live.games)) games = live.games;
  else if (Array.isArray(m.sets) && m.sets[setIdx] && Array.isArray(m.sets[setIdx].games)) {
    games = m.sets[setIdx].games;
  }

  return { setIndex: setIdx, games };
}

// ----------------- main -----------------
export default function classifyMatch(match = {}) {
  // 1) Run engine with hard guard
  let out = {};
  try {
    out = aiEngineV2(match) || {};
  } catch (err) {
    try { console.warn("[AI] aiEngineV2 threw:", err); } catch (_) {}
    out = {};
  }
  if (!out.raw || typeof out.raw !== "object") out.raw = {};

  // 2) Volatility fallback (module -> baseline)
  try {
    const hasEngineVol = isFiniteNum(out.raw.volatility);
    if (!hasEngineVol) {
      const ctx = buildVolatilityCtx(match);
      let vol = NaN;

      // try module first
      try {
        vol = volatilityScore(ctx);
      } catch (e) {
        try { console.warn("[VOL] module error:", e); } catch (_) {}
      }

      // diag
      try { console.log("[VOL] ctx=", ctx, "moduleVol=", vol); } catch (_) {}

      // safe baseline if module didn’t return finite
      if (!isFiniteNum(vol)) {
        // very conservative defaults:
        // • if δεν έχουμε games => 0.28 (ήρεμη αγορά)
        // • αν είμαστε σε set >= 2 => +0.05
        const base =
          Array.isArray(ctx.games) && ctx.games.length > 0
            ? 0.30
            : 0.28;
        const adj = ctx.setIndex >= 1 ? 0.05 : 0;
        vol = clamp(base + adj, 0.15, 0.75);
        try { console.log("[VOL] baseline applied ->", vol); } catch (_) {}
      }

      out.raw.volatility = vol;
      out.volatility = vol;
    } else {
      out.volatility = out.raw.volatility;
    }
  } catch (err) {
    try { console.warn("[AI] volatility fallback failed:", err); } catch (_) {}
  }

  // 3) Runtime markers (plain values)
  try {
    if (typeof window !== "undefined") {
      if (!window.__AI_VERSION__) window.__AI_VERSION__ = "v2.1";
      const volMarker = isFiniteNum(out.raw.volatility) ? out.raw.volatility : null;
      window.__AI_VOL__ = volMarker;
    }
  } catch (_) {}

  // 4) TIP fallback
  let tip = out.tip || null;
  if (!tip) {
    try {
      const p1Name =
        match?.players?.[0]?.name ||
        match?.player?.[0]?.["@name"] || "";
      if (p1Name) tip = `TIP: ${p1Name}`;
    } catch (_) {}
  }

  // 5) Telemetry (no-op if tuner missing)
  try {
    const nudges = typeof getNudges === "function" ? getNudges() : null;
    if (typeof recordDecision === "function") {
      recordDecision({
        matchId: match?.id || match?.matchId || null,
        label: out?.label ?? null,
        ev: out?.ev ?? null,
        confidence: out?.confidence ?? null,
        kelly: out?.kelly ?? null,
        volatility: isFiniteNum(out?.raw?.volatility) ? out.raw.volatility : null,
        nudges
      });
    }
  } catch (_) {}

  // 6) Return normalized
  return { ...out, tip };
}