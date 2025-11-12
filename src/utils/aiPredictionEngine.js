// src/utils/aiPredictionEngine.js
import aiEngineV2 from "./aiEngineV2";
import { getNudges, recordDecision } from "./telemetryTuner";

// --- GLOBAL BOOT MARKERS ---
(() => {
  try {
    const g = globalThis || window;
    if (!g.__AI_VERSION__) g.__AI_VERSION__ = "v2.1";
    if (typeof g.__AI_VOL__ === "undefined") g.__AI_VOL__ = null;
    console.info("[AI Boot] Markers initialized", {
      version: g.__AI_VERSION__,
      vol: g.__AI_VOL__,
    });
  } catch (err) {
    console.warn("[AI Boot] Init failed:", err);
  }
})();
// ----------------------------

export default function classifyMatch(match = {}) {
  const out = aiEngineV2(match) || {};

  // Update runtime markers dynamically
  try {
    const g = globalThis || window;
    g.__AI_VERSION__ = "v2.1";
    g.__AI_VOL__ = out?.raw?.volatility ?? null;
  } catch (err) {
    console.warn("[AI Adapter] Marker update failed:", err);
  }

  // fallback tip from odds
  let tip = out.tip || null;
  if (!tip) {
    try {
      const p1 =
        match?.players?.[0]?.name ||
        match?.player?.[0]?.["@name"] ||
        "";
      const p2 =
        match?.players?.[1]?.name ||
        match?.player?.[1]?.["@name"] ||
        "";
      const o1 = Number(match?.odds?.p1 ?? match?.odds?.home);
      const o2 = Number(match?.odds?.p2 ?? match?.odds?.away);
      if (Number.isFinite(o1) && Number.isFinite(o2)) {
        tip = o1 < o2 ? p1 : p2;
      }
    } catch {}
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