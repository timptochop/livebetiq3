// src/utils/aiPredictionEngine.js
// AI Engine Adapter (v3.2h) — stable volatility fallback + delayed marker write + debug logging.

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

  // 2) Compute volatility (engine → fallback → safe default)
  let vol = null;
  try {
    if (isFiniteNum(out.raw.volatility)) {
      vol = out.raw.volatility;
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
    // ignore marker errors
  }

  // 4) Label fallback rules (wire-fallback when cutoffs are missing)
  let ev = null;
  let conf = null;
  let label = out?.label ?? null;

  try {
    ev = isFiniteNum(out?.ev)
      ? Number(out.ev)
      : isFiniteNum(out?.raw?.ev)
      ? Number(out.raw.ev)
      : null;

    conf = isFiniteNum(out?.confidence)
      ? Number(out.confidence)
      : isFiniteNum(out?.conf)
      ? Number(out.conf)
      : null;

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
    } else {
      // keep whatever the engine gave us
      label = out?.label ?? label;
    }
  } catch (_) {
    // keep best-effort ev/conf/label
  }

  // 5) Fallback TIP for UI consistency
  let tip = out.tip || null;
  if (!tip) {
    try {
      const p1 =
        (match?.players && match.players[0] && match.players[0].name) ||
        (match?.player && match.player[0] && match.player[0]["@name"]) ||
        "";
      if (p1) tip = `TIP: ${p1}`;
    } catch (_) {
      // ignore tip errors
    }
  }

  // 6) Debug logging (adapter-level, safe in all environments)
  try {
    const matchId = match?.id || match?.matchId || null;
    const p1Name =
      (match?.players && match.players[0] && match.players[0].name) ||
      (match?.player && match.player[0] && match.player[0]["@name"]) ||
      null;
    const p2Name =
      (match?.players && match.players[1] && match.players[1].name) ||
      (match?.player && match.player[1] && match.player[1]["@name"]) ||
      null;

    if (typeof console !== "undefined" && console.log) {
      console.log("[AI Adapter v3.2h]", {
        id: matchId,
        players:
          p1Name && p2Name ? `${p1Name} vs ${p2Name}` : p1Name || p2Name || null,
        label: out?.label ?? label ?? null,
        ev: isFiniteNum(ev) ? ev : null,
        confidence: isFiniteNum(conf) ? conf : null,
        volatility: isFiniteNum(vol) ? vol : null,
        source: "adapter-wire-fallback",
      });
    }
  } catch (_) {
    // never break the app for logging
  }

  // 7) Telemetry (no-op if telemetryTuner is missing)
  try {
    const nudges = typeof getNudges === "function" ? getNudges() : null;
    if (typeof recordDecision === "function") {
      recordDecision({
        matchId: match?.id || match?.matchId || null,
        label: out?.label ?? label ?? null,
        ev: isFiniteNum(out?.ev) ? Number(out.ev) : null,
        confidence: isFiniteNum(out?.confidence)
          ? Number(out.confidence)
          : isFiniteNum(out?.conf)
          ? Number(out.conf)
          : null,
        kelly: isFiniteNum(out?.kelly) ? Number(out.kelly) : null,
        volatility: isFiniteNum(vol) ? vol : null,
        nudges,
      });
    }
  } catch (_) {
    // ignore telemetry errors
  }

  // 8) Return normalized object for the UI
  return {
    ...out,
    tip,
  };
}