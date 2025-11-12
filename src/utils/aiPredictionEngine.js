// src/utils/aiPredictionEngine.js
import aiEngineV2 from "./aiEngineV2";
import { getNudges, recordDecision } from "./telemetryTuner";

export default function classifyMatch(match = {}) {
  const out = aiEngineV2(match) || {};

  // expose runtime markers globally
  if (typeof window !== "undefined") {
    try {
      window.__AI_VERSION__ = "v2.1";
      window.__AI_VOL__ = out?.raw?.volatility ?? null;
    } catch (err) {
      console.warn("[AI Adapter] Marker set failed:", err);
    }
  }

  // fallback tip from odds if missing
  let tip = out.tip || null;
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
      const p1d = Number(match?.odds?.p1 ?? match?.odds?.player1 ?? match?.odds?.home);
      const p2d = Number(match?.odds?.p2 ?? match?.odds?.player2 ?? match?.odds?.away);
      if (Number.isFinite(p1d) && Number.isFinite(p2d)) {
        tip = p1d < p2d ? p1Name : p2Name;
      }
    } catch (e) {}
  }

  try {
    recordDecision(out.ctx, out.label);
  } catch {}

  return {
    label: out.label || null,
    conf: out.conf ?? null,
    kellyLevel: out.kellyLevel || null,
    tip: tip || null,
    features: {
      volatility: out?.raw?.volatility ?? null,
      drift: out?.raw?.drift ?? null,
      setNum: out?.raw?.setNum ?? null,
      live: out?.raw?.live ?? null,
      momentum: out?.raw?.momentum ?? null,
      surface: out?.raw?.surface ?? null,
      ctx: out?.ctx ?? null,
      nudges: out?.nudges ?? null,
    },
  };
}