// src/utils/aiPredictionEngine.js
// Single-responsibility adapter: runs aiEngineV2, shapes output for UI,
// exposes runtime markers (__AI_VERSION__, __AI_VOL__) safely.

import aiEngineV2 from "./aiEngineV2";
import { getNudges, recordDecision } from "./telemetryTuner";

/**
 * Safely set runtime markers without overwriting with null/undefined.
 */
function setRuntimeMarkers({ version, volatility }) {
  try {
    if (typeof window === "undefined") return;

    // Always stamp current engine version
    window.__AI_VERSION__ = String(version || "v2.1");

    // Only set volatility if we have a finite number
    const volNum =
      typeof volatility === "number" && Number.isFinite(volatility)
        ? volatility
        : null;

    if (volNum !== null) {
      window.__AI_VOL__ = volNum;
    }
    // If vol is null/undefined, DO NOT overwrite any existing value.
  } catch {
    /* no-op */
  }
}

/**
 * Build a simple odds-based fallback tip when the engine doesn't provide one.
 */
function buildFallbackTip(match, out) {
  // Prefer engine tip if present
  if (out && out.tip) return out.tip;

  try {
    const p1Name =
      match?.players?.[0]?.name ||
      match?.player?.[0]?.["@name"] ||
      "";
    const p2Name =
      match?.players?.[1]?.name ||
      match?.player?.[1]?.["@name"] ||
      "";

    const o1 =
      Number(match?.odds?.p1) ||
      Number(match?.odds?.player1) ||
      Number(match?.odds?.home) ||
      null;
    const o2 =
      Number(match?.odds?.p2) ||
      Number(match?.odds?.player2) ||
      Number(match?.odds?.away) ||
      null;

    // crude implied probs from decimal odds if both present
    if (o1 && o2 && o1 > 1 && o2 > 1) {
      const p1 = 1 / o1;
      const p2 = 1 / o2;
      const fav = p1 >= p2 ? p1Name : p2Name;
      if (fav) {
        return `TIP: ${fav}`;
      }
    }
  } catch {
    /* ignore tip fallback errors */
  }
  return null;
}

/**
 * Main adapter called by UI.
 */
export default function classifyMatch(match = {}) {
  // Run the core scoring engine (v2.1 tuned)
  const out = aiEngineV2(match) || {};

  // Expose runtime markers (version + volatility) WITHOUT null clobber
  // Try multiple paths for volatility (engine implementational detail)
  const volatility =
    out?.raw?.volatility ??
    out?.features?.volatility ??
    out?.volatility ??
    null;

  setRuntimeMarkers({ version: "v2.1", volatility });

  // Tip fallback
  let tip = buildFallbackTip(match, out);

  // Optional nudges / telemetry
  try {
    const nudges = getNudges?.() || null;
    if (nudges && out) out.nudges = nudges;
  } catch {
    /* ignore */
  }

  // Shape unified payload for the UI
  const shaped = {
    label: out?.label || out?.fallbackLabel || null,
    conf: typeof out?.conf === "number" ? out.conf : null,
    kellyLevel: out?.kellyLevel || null,
    tip: tip,
    // features for debugging panes
    features: {
      ...out?.features,
      raw: out?.raw,
    },
  };

  // Audit trail (if enabled)
  try {
    recordDecision?.({
      matchId: match?.id || match?.matchId || null,
      players: match?.players || match?.player || null,
      label: shaped.label,
      conf: shaped.conf,
      kellyLevel: shaped.kellyLevel,
      volatility,
      time: Date.now(),
    });
  } catch {
    /* ignore logging errors */
  }

  return shaped;
}π