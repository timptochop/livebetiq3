// src/utils/aiPredictionEngine.js
import aiEngineV2 from "./aiEngineV2";
import { getNudges, recordDecision } from "./telemetryTuner";

export default function classifyMatch(match = {}) {
  const out = aiEngineV2(match) || {};

  // Fallback tip if engine didn't provide one
  let tip = out.tip;
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
    } catch {
      /* noop */
    }
  }

  // Basic context for nudges/telemetry
  const ctx = {
    id: match?.id || match?.matchId || match?.["@id"] || null,
    category:
      match?.categoryName ||
      match?.["@category"] ||
      match?.category ||
      null,
    status:
      (match?.status || match?.["@status"] || "").toString(),
  };
  let nudges = null;
  try {
    nudges = getNudges(ctx);
  } catch {
    nudges = null;
  }

  try {
    if (out?.label) recordDecision(ctx, out.label);
  } catch {
    /* noop */
  }

  // Features snapshot for UI/debug
  const features = {
    pOdds: out?.raw?.A?.oddsEdge ?? null,
    momentum: out?.raw?.A?.setsLead ?? null,
    micro: out?.raw?.A?.gamesLead ?? null,
    serve: null,
    drift:
      typeof out?.raw?.A?.oddsEdge === "number" &&
      typeof out?.raw?.B?.oddsEdge === "number"
        ? out.raw.A.oddsEdge - out.raw.B.oddsEdge
        : null,
    setNum: Number(out?.raw?.setNum || 0),
    live: !!(out?.raw?.live),
    clutch: null,
    ctx,
    nudges,
  };

  // Expose minimal runtime debug signals to window (for manual checks)
  try {
    if (typeof window !== "undefined") {
      window.__AI_VERSION__ = "v2.1";
      window.__AI_VOL__ = out?.raw?.volatility ?? null;
    }
  } catch {
    /* noop */
  }

  return {
    label: out.label || null,
    conf: out.conf ?? null,
    kellyLevel: out.kellyLevel || null,
    tip: tip || null,
    features,
  };
}