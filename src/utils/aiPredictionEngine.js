// src/utils/aiPredictionEngine.js
// Adapter γύρω από το aiEngineV2 με ασφαλείς markers και
// "wire-fallback" κανόνες όταν δεν υπάρχουν cutoffs από το μοντέλο.

import aiEngineV2 from './aiEngineV2';
import volatilityScore from '../aiPredictionEngineModules/volatilityScore';
import { getNudges, recordDecision } from '../telemetryTuner'; // safe no-op αν λείπει

function isFiniteNum(x) {
  return Number.isFinite ? Number.isFinite(x) : (typeof x === 'number' && isFinite(x));
}

export default function classifyMatch(match = {}) {
  // 1) Τρέξε τον κινητήρα με σκληρό guard
  let out = {};
  try {
    out = aiEngineV2(match) || {};
  } catch (err) {
    try { console.warn('[AI] aiEngineV2 threw:', err); } catch (_) {}
    out = {};
  }

  // 2) Ασφαλή runtime markers (χωρίς getters/defineProperty)
  try {
    if (typeof window !== 'undefined') {
      if (!window.__AI_VERSION__) window.__AI_VERSION__ = 'v2.1';
      const volFromEngine =
        (out && out.raw && typeof out.raw.volatility !== 'undefined')
          ? out.raw.volatility
          : null;
      window.__AI_VOL__ = volFromEngine;
    }
  } catch (_) {
    /* ignore marker issues */
  }

  // 3) Δοκίμασε να συμπληρώσεις volatility αν λείπει (wire fallback)
  try {
    const hasVol = out && out.raw && typeof out.raw.volatility !== 'undefined';
    if (!hasVol) {
      const v = volatilityScore(match); // 0..1
      if (!out.raw) out.raw = {};
      out.raw.volatility = isFiniteNum(v) ? v : null;
      // ανανέωσε και το marker αν υπάρχει browser
      if (typeof window !== 'undefined') window.__AI_VOL__ = out.raw.volatility;
    }
  } catch (_) {
    // ignore
  }

  // 4) Wire-fallback για label όταν δεν υπάρχουν cutoffs (ή βγαίνει πάντα AVOID)
  //    Χρησιμοποιεί σταθερά thresholds πάνω σε ev & confidence.
  try {
    const ev =
      isFiniteNum(out?.ev) ? Number(out.ev)
        : isFiniteNum(out?.raw?.ev) ? Number(out.raw.ev)
        : null;

    // δέξου είτε confidence είτε conf
    const conf =
      isFiniteNum(out?.confidence) ? Number(out.confidence)
        : isFiniteNum(out?.conf) ? Number(out.conf)
        : null;

    let label = out?.label || null;

    // Fallback κανόνες μόνο όταν λείπει/είναι PENDING/είναι AVOID
    if ((!label || label === 'PENDING' || label === 'AVOID') && isFiniteNum(ev) && isFiniteNum(conf)) {
      // Συντηρητικά thresholds ώστε να παραμένει σταθερό το UI
      const SAFE_EV = 0.03, SAFE_CONF = 0.58;
      const RISKY_EV = 0.00, RISKY_CONF = 0.53;

      if (ev >= SAFE_EV && conf >= SAFE_CONF) label = 'SAFE';
      else if (ev >= RISKY_EV && conf >= RISKY_CONF) label = 'RISKY';
      else label = 'AVOID';

      out.label = label;
      out.ev = ev;
      // ομογενοποίησε το όνομα για το UI
      if (!isFiniteNum(out.confidence)) out.confidence = conf;
    }
  } catch (_) {
    // ignore fallback errors
  }

  // 5) TIP fallback για συνέπεια στο UI
  let tip = out.tip || null;
  if (!tip) {
    try {
      const p1Name =
        match?.players?.[0]?.name ||
        match?.player?.[0]?.['@name'] ||
        '';
      if (p1Name) tip = `TIP: ${p1Name}`;
    } catch (_) { /* ignore */ }
  }

  // 6) Προαιρετικά telemetry (no-op αν λείπουν)
  try {
    const nudges = typeof getNudges === 'function' ? getNudges() : null;
    if (typeof recordDecision === 'function') {
      recordDecision({
        matchId: match?.id || match?.matchId || null,
        label: out?.label ?? null,
        ev: isFiniteNum(out?.ev) ? Number(out.ev) : null,
        confidence: isFiniteNum(out?.confidence) ? Number(out.confidence) : (isFiniteNum(out?.conf) ? Number(out.conf) : null),
        kelly: isFiniteNum(out?.kelly) ? Number(out.kelly) : null,
        volatility: (out?.raw && 'volatility' in out.raw) ? out.raw.volatility : null,
        nudges
      });
    }
  } catch (_) {
    /* ignore telemetry errors */
  }

  // 7) Επιστροφή normalized αντικειμένου που περιμένει το UI
  return {
    ...out,
    tip
  };
}