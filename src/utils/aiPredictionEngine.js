// src/utils/aiPredictionEngine.js
import { extractFeatures, extractContext, score, toLabel } from "./aiEngineV2";
import { getNudges, recordDecision } from "./telemetryTuner";

export default function classifyMatch(match = {}) {
  const f = extractFeatures(match);
  const ctx = extractContext(match);
  const conf = score(f, ctx);

  const nudges = getNudges(ctx);
  const labelInfo = toLabel(conf, f, ctx, nudges);

  let tip;
  try {
    const p1Name = match?.players?.[0]?.name || match?.player?.[0]?.['@name'] || "";
    const p2Name = match?.players?.[1]?.name || match?.player?.[1]?.['@name'] || "";
    const p1d = Number(match?.odds?.p1 ?? match?.odds?.player1 ?? match?.odds?.home);
    const p2d = Number(match?.odds?.p2 ?? match?.odds?.player2 ?? match?.odds?.away);
    if (Number.isFinite(p1d) && Number.isFinite(p2d)) tip = p1d < p2d ? p1Name : p2Name;
  } catch {}

  try { recordDecision(ctx, labelInfo.label); } catch {}

  return {
    label: labelInfo.label,
    conf,
    kellyLevel: labelInfo.kellyLevel,
    tip,
    features: {
      pOdds: f.pOdds,
      momentum: f.momentum,
      micro: f.micro,
      serve: f.serve,
      drift: f.drift - 0.5,
      setNum: Math.round(f.setNum * 5),
      live: f.live,
      clutch: f.clutch,
      ctx,
      nudges,
    },
  };
}