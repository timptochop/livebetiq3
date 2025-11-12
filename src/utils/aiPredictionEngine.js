// src/utils/aiPredictionEngine.js
// Stable adapter around aiEngineV2 with safe, non-recursive runtime markers.
// Wires in volatilityScore as a fallback when the engine does not provide volatility.

import aiEngineV2 from "./aiEngineV2";
import volatilityScore from "../aiPredictionEngineModules/volatilityScore";
import { getNudges, recordDecision } from "../telemetryTuner"; // safe no-op if not present

function isFiniteNum(x) {
  return Number.isFinite ? Number.isFinite(x) : (typeof x === "number" && isFinite(x));
}

export default function classifyMatch(match = {}) {
  // 1) Run engine with hard guard
  let out = {};
  try {
    out = aiEngineV2(match) || {};
  } catch (err) {
    try { console.warn("[AI] aiEngineV2 threw:", err); } catch (_) {}
    out = {};
  }

  // 2) Ensure `out.raw` container exists
  if (!out.raw || typeof out.raw !== "object") {
    out.raw = {};
  }

  // 3) Volatility: prefer engine value; otherwise compute via module
  let volatility = null;
  try {
    if (isFiniteNum(out?.raw?.volatility)) {
      volatility = Number(out.raw.volatility);
    } else if (typeof volatilityScore === "function") {
      // Minimal, defensive context (the module tolerates sparse input)
      const computed = volatilityScore(match);
      if (isFiniteNum(computed)) volatility = computed;
    }
  } catch (_) {
    // never break the adapter
  }
  if (isFiniteNum(volatility)) {
    out.raw.volatility = volatility;
  } else {
    out.raw.volatility = null;
  }

  // 4) Attach simple runtime markers (plain assignments only; no getters)
  try {
    if (typeof window !== "undefined") {
      if (!window.__AI_VERSION__) window.__AI_VERSION__ = "v2.1";
      window.__AI_VOL__ = out.raw.volatility ?? null;
    }
  } catch (_) {
    // ignore marker issues
  }

  // 5) Fallback tip if engine didn’t produce one (keeps UI consistent)
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

  // 6) Optional: telemetry hooks (safe no-ops if not wired)
  try {
    const nudges = typeof getNudges === "function" ? getNudges() : null;
    if (typeof recordDecision === "function") {
      recordDecision({
        matchId: match?.id || match?.matchId || null,
        label: out?.label || null,
        ev: out?.ev ?? null,
        confidence: out?.confidence ?? null,
        kelly: out?.kelly ?? null,
        volatility: out?.raw?.volatility ?? null,
        nudges
      });
    }
  } catch (_) {
    // ignore telemetry errors
  }

  // 7) Return normalized object the UI expects
  return {
    ...out,
    tip
  };
}