// src/utils/aiPredictionEngine.js
// Stable adapter around aiEngineV2 with safe, non-recursive runtime markers.

import aiEngineV2 from "./aiEngineV2";
import { getNudges, recordDecision } from "../telemetryTuner"; // keep if exists; otherwise it's harmless

export default function classifyMatch(match = {}) {
  // 1) Run engine with hard guard
  let out = {};
  try {
    out = aiEngineV2(match) || {};
  } catch (err) {
    // engine failed; keep adapter resilient
    try {
      console.warn("[AI] aiEngineV2 threw:", err);
    } catch (_) {}
    out = {};
  }

  // 2) Attach simple runtime markers (NO getters, NO defineProperty -> avoid recursion)
  //    We only ever assign plain values. This avoids the "Maximum call stack size exceeded".
  try {
    if (typeof window !== "undefined") {
      // Version marker (static if engine didn't supply one)
      if (!window.__AI_VERSION__) {
        window.__AI_VERSION__ = "v2.1";
      }
      // Volatility marker (nullable)
      const vol =
        (out && out.raw && typeof out.raw.volatility !== "undefined")
          ? out.raw.volatility
          : null;
      window.__AI_VOL__ = vol;
    }
  } catch (_) {
    // never break classifyMatch for marker issues
  }

  // 3) Fallback tip if engine didn’t produce one (keeps UI consistent)
  let tip = out.tip || null;
  if (!tip) {
    try {
      const p1Name =
        match?.players?.[0]?.name ||
        match?.player?.[0]?.["@name"] ||
        "";
      if (p1Name) tip = `TIP: ${p1Name}`;
    } catch (_) {
      // ignore
    }
  }

  // 4) Optional: telemetry hooks (safe no-ops if not wired)
  try {
    const nudges = typeof getNudges === "function" ? getNudges() : null;
    if (typeof recordDecision === "function") {
      recordDecision({
        matchId: match?.id || match?.matchId || null,
        label: out?.label || null,
        ev: out?.ev ?? null,
        confidence: out?.confidence ?? null,
        kelly: out?.kelly ?? null,
        volatility: (out?.raw?.volatility ?? null),
        nudges
      });
    }
  } catch (_) {
    // ignore telemetry errors
  }

  // 5) Return normalized object the UI expects
  return {
    ...out,
    tip
  };
}