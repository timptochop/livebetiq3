// utils/aiPredictionEngine.js
import { getDrift } from "./oddsTracker";

export function decideLabel(match, analysis) {
  const { setNum = 1, live } = match || {};
  const { score = 0.5, conf = 0.5 } = analysis || {};

  // optional odds drift (%): αρνητικό = προς το φαβορί που υποστηρίζουμε
  const drift = getDrift(match.id) ?? 0; // π.χ. -0.06 = -6%

  let label = "SOON";
  if (live) {
    // αυστηρό SAFE
    if (conf >= 0.82 && drift <= -0.05) label = "SAFE";
    else if (conf >= 0.68) label = "RISKY";
    else label = `SET ${Math.max(1, setNum)}`;
  } else {
    label = "SOON";
  }

  // Kelly επίπεδο από την εμπιστοσύνη
  let kellyLevel = "LOW";
  if (conf >= 0.85) kellyLevel = "HIGH";
  else if (conf >= 0.72) kellyLevel = "MED";

  return { label, kellyLevel, conf, drift, score };
}