// src/utils/aiPredictionEngine.js
//
// Κεντρικό API του μοντέλου.
// Χρησιμοποιείται από analyzeMatch -> LiveTennis.

import { extractFeatures, score, toLabel } from "./aiEngineV2";

export default function classifyMatch(match = {}) {
  const f = extractFeatures(match);
  const conf = score(f);

  // Πρόχειρο tip: προτείνει το «φαβορί» αν έχουμε odds, αλλιώς τίποτα
  const p1d = match?.odds?.p1 ?? match?.odds?.player1 ?? match?.odds?.home;
  const p2d = match?.odds?.p2 ?? match?.odds?.player2 ?? match?.odds?.away;

  let tip;
  try {
    const p1Name = match?.players?.[0]?.name || match?.player?.[0]?.['@name'];
    const p2Name = match?.players?.[1]?.name || match?.player?.[1]?.['@name'];
    // χαμηλότερα decimal = ισχυρότερος
    const d1 = Number(p1d);
    const d2 = Number(p2d);
    if (Number.isFinite(d1) && Number.isFinite(d2)) {
      tip = d1 < d2 ? p1Name : p2Name;
    }
  } catch {
    tip = undefined;
  }

  const labelInfo = toLabel(conf, f);

  return {
    label: labelInfo.label,
    conf,
    kellyLevel: labelInfo.kellyLevel,
    tip,
    features: {
      pOdds: f.pOdds,
      momentum: f.momentum,
      drift: f.drift - 0.5, // επαναφορά σε ~[-0.2..0.2] για debugging
      setNum: Math.round(f.setNum * 5),
      live: f.live,
    },
  };
}