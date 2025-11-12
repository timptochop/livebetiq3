// src/utils/aiPredictionEngine.js
// AI Engine Adapter (v3.2f) — Guarantees volatility fallback + stable window markers.

import aiEngineV2 from './aiEngineV2';
import volatilityScore from '../aiPredictionEngineModules/volatilityScore';
import { getNudges, recordDecision } from '../telemetryTuner';

function isFiniteNum(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

export default function classifyMatch(match = {}) {
  let out = {};
  try {
    out = aiEngineV2(match) || {};
  } catch (err) {
    console.warn('[AI] aiEngineV2 threw:', err);
    out = {};
  }
  if (!out.raw) out.raw = {};

  // (1) Calculate volatility first (wire fallback)
  let vol = null;
  try {
    if (isFiniteNum(out.raw.volatility)) {
      vol = out.raw.volatility;
    } else {
      vol = volatilityScore(match);
      if (!isFiniteNum(vol)) vol = 0.25; // hard fallback default
      out.raw.volatility = vol;
    }
  } catch (_) {
    vol = 0.25;
    out.raw.volatility = vol;
  }

  // (2) Safe version markers (set after computation)
  try {
    if (typeof window !== 'undefined') {
      window.__AI_VERSION__ = 'v2.1';
      window.__AI_VOL__ = vol;
    }
  } catch (_) {}

  // (3) Label fallback logic (SAFE / RISKY / AVOID)
  try {
    const ev = isFiniteNum(out?.ev)
      ? Number(out.ev)
      : isFiniteNum(out?.raw?.ev)
      ? Number(out.raw.ev)
      : null;
    const conf = isFiniteNum(out?.confidence)
      ? Number(out.confidence)
      : isFiniteNum(out?.conf)
      ? Number(out.conf)
      : null;

    let label = out?.label || null;
    if ((!label || label === 'PENDING' || label === 'AVOID') && isFiniteNum(ev) && isFiniteNum(conf)) {
      const SAFE_EV = 0.03, SAFE_CONF = 0.58;
      const RISKY_EV = 0.00, RISKY_CONF = 0.53;

      if (ev >= SAFE_EV && conf >= SAFE_CONF) label = 'SAFE';
      else if (ev >= RISKY_EV && conf >= RISKY_CONF) label = 'RISKY';
      else label = 'AVOID';

      out.label = label;
      out.ev = ev;
      if (!isFiniteNum(out.confidence)) out.confidence = conf;
    }
  } catch (_) {}

  // (4) Generate tip fallback
  let tip = out.tip || null;
  if (!tip) {
    try {
      const p1 =
        match?.players?.[0]?.name ||
        match?.player?.[0]?.['@name'] ||
        '';
      if (p1) tip = `TIP: ${p1}`;
    } catch (_) {}
  }

  // (5) Telemetry (safe no-op)
  try {
    const nudges = typeof getNudges === 'function' ? getNudges() : null;
    if (typeof recordDecision === 'function') {
      recordDecision({
        matchId: match?.id || match?.matchId || null,
        label: out?.label ?? null,
        ev: isFiniteNum(out?.ev) ? Number(out.ev) : null,
        confidence: isFiniteNum(out?.confidence)
          ? Number(out.confidence)
          : isFiniteNum(out?.conf)
          ? Number(out.conf)
          : null,
        kelly: isFiniteNum(out?.kelly) ? Number(out.kelly) : null,
        volatility: vol,
        nudges,
      });
    }
  } catch (_) {}

  return { ...out, tip };
}