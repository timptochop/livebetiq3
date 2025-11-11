// src/utils/aiPredictionEngine.js
// Adapter: uses the default engine (aiEngineV2) and exposes a stable API for the UI.

import aiEngineV2 from "./aiEngineV2";
import { getNudges, recordDecision } from "./telemetryTuner";

export default function classifyMatch(match = {}) {
  const out = aiEngineV2(match) || {};

  let tip = out.tip;
  if (!tip) {
    try {
      const p1Name =
        match?.players?.[0]?.name || match?.player?.[0]?.["@name"] || "";
      const p2Name =
        match?.players?.[1]?.name || match?.player?.[1]?.["@name"] || "";
      const p1d = Number(
        match?.odds?.p1 ?? match?.odds?.player1 ?? match?.odds?.home
      );
      const p2d = Number(
        match?.odds?.p2 ?? match?.odds?.player2 ?? match?.odds?.away
      );
      if (Number.isFinite(p1d) && Number.isFinite(p2d)) {
        tip = p1d < p2d ? p1Name : p2Name;
      }
    } catch {
      /* no-op */
    }
  }

  const ctx = {
    matchId: match.id || match.matchId || match["@id"] || null,
    category:
      match.categoryName || match.category || match["@category"] || null,
    setNum: Number(match.setNum || out?.raw?.setNum || 0),
    live: !!(out?.raw?.live),
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
    /* no-op */
  }

  const features = {
    pOdds: match?.odds ?? match?.prematchOdds ?? null,
    momentum: null,
    micro: null,
    serve: null,
    drift: null,
    setNum: Number(out?.raw?.setNum || 0),
    live: !!(out?.raw?.live),
    clutch: null,
    ctx,
    nudges,
  };

  return {
    label: out.label || null,
    conf: out.conf ?? null,
    kellyLevel: out.kellyLevel || null,
    tip: tip || null,
    features,
  };
}