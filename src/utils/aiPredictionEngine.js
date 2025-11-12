// src/utils/aiPredictionEngine.js
import aiEngineV2 from "./aiEngineV2";
import { getNudges, recordDecision } from "./telemetryTuner";

/**
 * Volatility adjustment:
 * - High vol penalizes confidence gently (up to -0.05).
 * - Very low vol adds a tiny boost (up to +0.02).
 * This is deliberately mild to avoid UI churn.
 */
function applyVolatilityAdjustment(baseConf, volatility) {
  let conf = Number(baseConf ?? 0);
  const vol = typeof volatility === "number" ? volatility : null;

  if (vol == null || Number.isNaN(vol)) return conf;

  // Penalty when vol > 0.25 (linear to max -0.05 @ vol >= 0.50)
  const penalty =
    vol > 0.25 ? -Math.min(0.05, (vol - 0.25) * 0.2) : 0;

  // Tiny boost when vol < 0.10 (up to +0.02 @ vol <= 0.00)
  const boost =
    vol < 0.10 ? Math.min(0.02, (0.10 - vol) * 0.2) : 0;

  const adjusted = Math.max(0, Math.min(1, conf + penalty + boost));
  return adjusted;
}

function downgradeLabelIfNeeded(label, conf) {
  // If engine returned SAFE but confidence after penalty < 0.56, downgrade to RISKY.
  if (label === "SAFE" && (conf ?? 0) < 0.56) return "RISKY";
  return label;
}

export default function classifyMatch(match = {}) {
  const out = aiEngineV2(match) || {};

  // expose runtime markers for verification (LOCKDOWN+ checks)
  try {
    if (typeof window !== "undefined") {
      window.__AI_VERSION__ = "v2.1";
      window.__AI_VOL__ = out?.raw?.volatility ?? window.__AI_VOL__ ?? null;
      // one-time boot marker
      if (!window.__AI_BOOT_LOGGED__) {
        console.info(
          "[AI Boot] Markers initialized (__AI_VERSION__, __AI_VOL__)",
          "(version:", window.__AI_VERSION__ + ", volatility:", window.__AI_VOL__, ")"
        );
        window.__AI_BOOT_LOGGED__ = true;
      }
    }
  } catch (_) {}

  // fallback tip from odds if engine did not provide one
  let tip = out?.tip || null;
  if (!tip) {
    try {
      const p1Name =
        match?.players?.[0]?.name ||
        match?.player?.[0]?.["@name"] ||
        "";
      if (p1Name) tip = `TIP: ${p1Name}`;
    } catch (_) {}
  }

  // === Volatility-aware confidence ===
  const runtimeVol =
    out?.raw?.volatility ??
    (typeof window !== "undefined" ? window.__AI_VOL__ : null) ??
    null;

  const baseConf = out?.conf ?? null;
  const conf = applyVolatilityAdjustment(baseConf, runtimeVol);
  const finalLabel = downgradeLabelIfNeeded(out?.label || null, conf);

  // telemetry / debug (silent in production unless console opened)
  try {
    const ctx = {
      ev: out?.raw?.ev ?? null,
      conf_before: baseConf,
      conf_after: conf,
      volatility: runtimeVol,
      label_before: out?.label ?? null,
      label_after: finalLabel,
    };
    if (process.env.NODE_ENV !== "production" || window?.LOG_PREDICTIONS) {
      console.debug("[AI Adapt] vol-adjust", ctx);
    }
    recordDecision?.(ctx);
  } catch (_) {}

  // features snapshot for UI/inspection
  const features = {
    drift: out?.raw?.drift ?? null,
    setNum: Number(out?.raw?.setNum || 0),
    live: !!(out?.raw?.live),
    clutch: null,
    ctx: out?.raw ?? null,
    nudges: getNudges?.() ?? null,
    volatility: runtimeVol,
    confBefore: baseConf,
    confAfter: conf,
  };

  return {
    label: finalLabel || null,
    conf: conf ?? null,
    kellylevel: out?.kellyLevel || null,
    tip: tip || null,
    features,
  };
}