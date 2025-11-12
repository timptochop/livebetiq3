// src/utils/aiPredictionEngine.js
// v3.3-wire — Stable adapter around aiEngineV2 with safe runtime markers,
// plus volatility fallback via aiPredictionEngineModules/volatilityScore.

import aiEngineV2 from "./aiEngineV2";
import volatilityScore from "../aiPredictionEngineModules/volatilityScore";
import { getNudges, recordDecision } from "../telemetryTuner"; // safe no-op if not present

// ---- helpers ---------------------------------------------------------------

function isFiniteNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

function clamp(n, min, max) {
  if (!isFiniteNum(n)) return min;
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

/**
 * Best-effort extraction of set index and games timeline from a variety of feeds.
 * Always returns a safe, minimal ctx the volatility module can handle.
 */
function buildVolatilityCtx(match = {}) {
  // try to infer current set (0-based)
  let setIdx = 0;

  // common shapes we’ve seen in this project
  const m = match || {};
  const live = m.live || m.status || m.score || {};

  // 1) explicit numeric fields if present
  if (isFiniteNum(m.currentSet)) {
    setIdx = clamp(Number(m.currentSet) - 1, 0, 2);
  } else if (isFiniteNum(live.currentSet)) {
    setIdx = clamp(Number(live.currentSet) - 1, 0, 2);
  } else if (Array.isArray(m.sets)) {
    // if sets array exists, use its length-1 (0-based)
    setIdx = clamp(m.sets.length - 1, 0, 2);
  }

  // 2) extract games array (very tolerant)
  // Expectation: an array of numbers or objects per game; the module tolerates mixed content.
  let games = [];
  if (Array.isArray(m.games)) games = m.games;
  else if (Array.isArray(live.games)) games = live.games;
  else if (Array.isArray(m.sets) && m.sets[setIdx] && Array.isArray(m.sets[setIdx].games)) {
    games = m.sets[setIdx].games;
  }

  return {
    setIndex: setIdx,
    games
  };
}

// ---- main adapter ----------------------------------------------------------

export default function classifyMatch(match = {}) {
  // 1) Run engine with hard guard
  let out = {};
  try {
    out = aiEngineV2(match) || {};
  } catch (err) {
    try { console.warn("[AI] aiEngineV2 threw:", err); } catch (_) {}
    out = {};
  }

  // Ensure structural shape we rely on
  if (!out.raw || typeof out.raw !== "object") out.raw = {};

  // 2) Volatility fallback (only if engine didn't provide a numeric value)
  try {
    const hasEngineVol = isFiniteNum(out.raw.volatility);
    if (!hasEngineVol) {
      const ctx = buildVolatilityCtx(match);
      const vol = volatilityScore(ctx);
      if (isFiniteNum(vol)) {
        out.raw.volatility = vol;
        // bubble up a top-level convenience field (kept optional to not break UI)
        out.volatility = vol;
      }
    } else {
      // bubble up engine-provided value as well
      out.volatility = out.raw.volatility;
    }
  } catch (err) {
    try { console.warn("[AI] volatility fallback failed:", err); } catch (_) {}
    // keep going without volatility
  }

  // 3) Runtime markers (plain assignments — no getters/proxies)
  try {
    if (typeof window !== "undefined") {
      if (!window.__AI_VERSION__) window.__AI_VERSION__ = "v2.1";
      const volMarker = isFiniteNum(out.raw.volatility) ? out.raw.volatility : null;
      window.__AI_VOL__ = volMarker;
    }
  } catch (_) {
    // never break classifyMatch for marker issues
  }

  // 4) TIP fallback to keep UI consistent
  let tip = out.tip || null;
  if (!tip) {
    try {
      const p1Name =
        match?.players?.[0]?.name ||
        match?.player?.[0]?.["@name"] ||
        "";
      if (p1Name) tip = `TIP: ${p1Name}`;
    } catch (_) { /* ignore */ }
  }

  // 5) Optional telemetry (no-op if tuner not present)
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
  } catch (_) {
    // ignore telemetry errors
  }

  // 6) Return normalized object the UI expects
  return {
    ...out,
    tip
  };
}