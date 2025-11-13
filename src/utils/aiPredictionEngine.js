// src/utils/aiPredictionEngine.js
// AI Engine Adapter (v3.2g) — Stable volatility fallback with delayed marker write.

import aiEngineV2 from "./aiEngineV2";
import volatilityScore from "../aiPredictionEngineModules/volatilityScore";
import { getNudges, recordDecision } from "../telemetryTuner";

function isFiniteNum(x) {
  return typeof x === "number" && Number.isFinite(x);
}

export default function classifyMatch(match = {}) {
  // 1) Run core engine with hard guard
  let out = {};
  try {
    out = aiEngineV2(match) || {};
  } catch (err) {
    try {
      console.warn("[AI] aiEngineV2 threw:", err);
    } catch (_) {}
    out = {};
  }

  if (!out.raw) out.raw = {};

  // 2) Compute volatility (fallback-safe)
  let vol = null;
  try {
    if (isFiniteNum(out.raw.volatility)) {
      vol = Number(out.raw.volatility);
    } else {
      vol = volatilityScore(match);
      if (!isFiniteNum(vol)) vol = 0.25; // safe default
      out.raw.volatility = vol;
    }
  } catch (_) {
    vol = 0.25;
    out.raw.volatility = vol;
  }

  // 3) Runtime markers (immediate + delayed rebind for hydration safety)
  try {
    if (typeof window !== "undefined") {
      window.__AI_VERSION__ = "v2.1";
      window.__AI_VOL__ = vol;
      setTimeout(() => {
        try {
          if (typeof window !== "undefined") {
            window.__AI_VOL__ = vol;
          }
        } catch (_) {}
      }, 500);
    }
  } catch (_) {
    // never break classifyMatch because of markers
  }

  // 4) Wire-fallback label rules (SAFE / RISKY / AVOID)
  try {
    const ev = isFiniteNum(out?.ev)
      ? Number(out.ev)
      : isFiniteNum(out?.raw?.ev)
      ? Number(out.raw.ev)
      : null;

    const conf = isFiniteNum(out?.confidence)
      ? Number(out.confidence)
      : isFiniteNum(out?.conf)
      ? Number(out.conf)
      : null;

    let label = out?.label || null;

    if (
      (!label || label === "PENDING" || label === "AVOID") &&
      isFiniteNum(ev) &&
      isFiniteNum(conf)
    ) {
      const SAFE_EV = 0.03;
      const SAFE_CONF = 0.58;
      const RISKY_EV = 0.0;
      const RISKY_CONF = 0.53;

      if (ev >= SAFE_EV && conf >= SAFE_CONF) {
        label = "SAFE";
      } else if (ev >= RISKY_EV && conf >= RISKY_CONF) {
        label = "RISKY";
      } else {
        label = "AVOID";
      }

      out.label = label;
      out.ev = ev;
      if (!isFiniteNum(out.confidence)) {
        out.confidence = conf;
      }
    }
  } catch (_) {
    // ignore fallback errors
  }

  // 5) TIP fallback for UI consistency
  let tip = out.tip || null;
  if (!tip) {
    try {
      const p1 =
        match?.players?.[0]?.name ||
        match?.player?.[0]?.["@name"] ||
        "";
      if (p1) tip = `TIP: ${p1}`;
    } catch (_) {
      // ignore
    }
  }

  // 6) Telemetry (safe no-op if hooks are missing)
  try {
    const nudges = typeof getNudges === "function" ? getNudges() : null;
    if (typeof recordDecision === "function") {
      recordDecision({
        matchId: match?.id || match?.matchId || null,
        label: out?.label ?? null,
        ev: isFiniteNum(out?.ev) ? Number(out.ev) : null,
        confidence: isFiniteNum(out?.confidence)
          ? Number(out.confidence)
          : isFiniteNum(out?.conf)
          ? Number(out.conf)
          : null,
        kelly: isFiniteNum(out?.kelly) ? Number(out.kelly) : null,
        volatility: vol,
        nudges,
      });
    }
  } catch (_) {
    // ignore telemetry errors
  }

  // 7) Return normalized object for UI
  return {
    ...out,
    tip,
  };
}