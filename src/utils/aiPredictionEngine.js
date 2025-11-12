// src/utils/aiPredictionEngine.js
// Stable adapter around aiEngineV2 with safe runtime markers and wire fallback rules.
// Adds write-back volatility fallback so that both engine and UI can see the same value.

import aiEngineV2 from './aiEngineV2';
import volatilityScore from '../aiPredictionEngineModules/volatilityScore';
import { getNudges, recordDecision } from '../telemetryTuner'; // safe no-op if missing

function isFiniteNum(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

export default function classifyMatch(match = {}) {
  // 1) Run engine with guard
  let out = {};
  try {
    out = aiEngineV2(match) || {};
  } catch (err) {
    try { console.warn('[AI] aiEngineV2 threw:', err); } catch (_) {}
    out = {};
  }

  // 2) Runtime markers (no getters/defineProperty)
  try {
    if (typeof window !== 'undefined') {
      if (!window.__AI_VERSION__) window.__AI_VERSION__ = 'v2.1';
      const volFromEngine =
        out && out.raw && typeof out.raw.volatility !== 'undefined'
          ? out.raw.volatility
          : null;
      window.__AI_VOL__ = volFromEngine;
    }
  } catch (_) {
    /* ignore marker issues */
  }

  // 3) Ensure volatility exists (wire fallback)
  try {
    const hasVol = out && out.raw && typeof out.raw.volatility !== 'undefined';
    if (!hasVol) {
      const v = volatilityScore(match); // 0..1
      if (!out.raw) out.raw = {};
      if (isFiniteNum(v)) out.raw.volatility = v;
      else out.raw.volatility = null;
      if (typeof window !== 'undefined') window.__AI_VOL__ = out.raw.volatility;
    }
  } catch (_) {
    /* ignore */
  }

  // 4) Wire fallback for label when cutoffs are missing (e.g. all AVOID)
  try {
    const ev =
      isFiniteNum(out?.ev)
        ? Number(out.ev)
        : isFiniteNum(out?.raw?.ev)
        ? Number(out.raw.ev)
        : null;

    const conf =
      isFiniteNum(out?.confidence)
        ? Number(out.confidence)
        : isFiniteNum(out?.conf)
        ? Number(out.conf)
        : null;

    let label = out?.label || null;

    // Only fallback when missing, PENDING, or AVOID
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
  } catch (_) {
    /* ignore fallback errors */
  }

  // 5) TIP fallback for UI consistency
  let tip = out.tip || null;
  if (!tip) {
    try {
      const p1Name =
        match?.players?.[0]?.name ||
        match?.player?.[0]?.['@name'] ||
        '';
      if (p1Name) tip = `TIP: ${p1Name}`;
    } catch (_) {
      /* ignore */
    }
  }

  // 6) Telemetry (safe no-op)
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
        volatility:
          out?.raw && 'volatility' in out.raw ? out.raw.volatility : null,
        nudges
      });
    }
  } catch (_) {
    /* ignore telemetry errors */
  }

  // 7) Return normalized output for UI
  return {
    ...out,
    tip
  };
}