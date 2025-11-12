// src/utils/aiPredictionEngine.js
import aiEngineV2 from "./aiEngineV2";
import { getNudges, recordDecision } from "./telemetryTuner";

export default function classifyMatch(match = {}) {
  const out = aiEngineV2(match) || {};

  // expose runtime markers for verification
  try {
    if (typeof window !== "undefined") {
      window.__AI_VERSION__ = "v2.1";
      window.__AI_VOL__ = out?.raw?.volatility ?? null;
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
      const p2Name =
        match?.players?.[1]?.name ||
        match?.player?.[1]?.["@name"] ||
        "";
      const p1d = Number(
        match?.odds?.p1 ??
          match?.odds?.player1 ??
          match?.odds?.home
      );
      const p2d = Number(
        match?.odds?.p2 ??
          match?.odds?.player2 ??
          match?.odds?.away
      );
      if (Number.isFinite(p1d) && Number.isFinite(p2d)) {
        tip = p1d < p2d ? p1Name : p2Name;
      }
    } catch (_) {}
  }

  // telemetry nudges (safe if tuner missing)
  let ctx = null;
  let nudges = null;
  try {
    ctx = out?.raw?.ctx || null;
    nudges = getNudges ? getNudges(ctx) : null;
  } catch (_) {
    ctx = null;
    nudges = null;
  }
  try {
    if (recordDecision && out?.label) {
      recordDecision(ctx, out.label);
    }
  } catch (_) {}

  const features = {
    pOdds: out?.raw?.pOdds ?? null,
    momentum: out?.raw?.momentum ?? null,
    micro: out?.raw?.micro ?? null,
    serve: out?.raw?.serve ?? null,
    drift: out?.raw?.drift ?? null,
    setNum: Number(out?.raw?.setNum || 0),
    live: !!(out?.raw?.live),
    clutch: out?.raw?.clutch ?? null,
    ctx,
    nudges
  };

  return {
    label: out?.label || null,
    conf: out?.conf ?? null,
    kellyLevel: out?.kellyLevel || null,
    tip: tip || null,
    features
  };
}