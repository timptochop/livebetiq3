// src/utils/analyzeMatch.js
import classifyMatch from "./aiPredictionEngine";

/**
 * Unified facade for the AI engine (v2).
 * Always returns a well-formed object for the UI.
 */
export default function analyzeMatch(m = {}) {
  try {
    const res = classifyMatch(m);
    // Defensive: guarantee shape for the UI
    return {
      label: res?.label ?? "PENDING",
      conf: Number.isFinite(res?.conf) ? res.conf : 0.5,
      kellyLevel: res?.kellyLevel ?? "LOW",
      tip: res?.tip,
      features: {
        pOdds: res?.features?.pOdds ?? 0.5,
        momentum: res?.features?.momentum ?? 0.5,
        drift: res?.features?.drift ?? 0,
        setNum: res?.features?.setNum ?? 0,
        live: !!res?.features?.live,
      },
    };
  } catch {
    // Fallback if anything blows up
    return {
      label: "PENDING",
      conf: 0.5,
      kellyLevel: "LOW",
      features: { pOdds: 0.5, momentum: 0.5, drift: 0, setNum: 0, live: false },
    };
  }
}