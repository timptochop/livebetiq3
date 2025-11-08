// src/utils/loadLbqConfig.js
// Unified loader: pulls WEIGHTS + CUTOFFS αποκλειστικά από /api/lbqcc
// Κανένα direct call σε script.google.com (GAS). Ασφαλές για CORS.

const MODEL_URL = process.env.REACT_APP_MODEL_URL || '/api/lbqcc';

const DEFAULT_WEIGHTS = {
  ev: 0.3,
  confidence: 0.25,
  momentum: 0.15,
  drift: 0.1,
  surface: 0.1,
  form: 0.1,
};

const DEFAULT_CUTOFFS = {
  thrSafe: 0.61,
  thrRisky: 0.40,
  minEV: 0.02,
};

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function parseDateSafe(v) {
  if (!v) return 0;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

function coreFromResponse(data) {
  if (!data) return null;
  if (data.ok === true && data.data && typeof data.data === 'object') return data.data;
  if (data.ok === true) return data;
  if (typeof data === 'object') return data;
  return null;
}

function normalizeWeights(core) {
  if (!core || typeof core !== 'object') return { ...DEFAULT_WEIGHTS };
  return {
    ev:         num(core.ev,        DEFAULT_WEIGHTS.ev),
    confidence: num(core.confidence,DEFAULT_WEIGHTS.confidence),
    momentum:   num(core.momentum,  DEFAULT_WEIGHTS.momentum),
    drift:      num(core.drift,     DEFAULT_WEIGHTS.drift),
    surface:    num(core.surface,   DEFAULT_WEIGHTS.surface),
    form:       num(core.form,      DEFAULT_WEIGHTS.form),
  };
}

function normalizeCutoffs(core) {
  if (!core || typeof core !== 'object') return { ...DEFAULT_CUTOFFS };

  const thrSafe =
    typeof core.thrSafe === 'number' ? core.thrSafe :
    typeof core.safeConf === 'number' ? core.safeConf :
    typeof core.minSAFE === 'number' ? core.minSAFE : DEFAULT_CUTOFFS.thrSafe;

  const thrRisky =
    typeof core.thrRisky === 'number' ? core.thrRisky :
    typeof core.riskyConf === 'number' ? core.riskyConf :
    typeof core.minRISKY === 'number' ? core.minRISKY : DEFAULT_CUTOFFS.thrRisky;

  const minEV = typeof core.minEV === 'number' ? core.minEV : DEFAULT_CUTOFFS.minEV;

  return { thrSafe, thrRisky, minEV };
}

async function fetchUnified() {
  const r = await fetch(`${MODEL_URL}?mode=config&ts=${Date.now()}`, {
    method: 'GET',
    headers: { 'cache-control': 'no-cache' },
  });
  if (!r.ok) throw new Error(`lbqcc-${r.status}`);
  const j = await r.json();
  const core = coreFromResponse(j);

  const weights = normalizeWeights(core);
  const cutoffs = normalizeCutoffs(core);

  const meta = {
    generatedAt: core?._generatedAt || core?.generatedAt || null,
    source: core?._source || 'lbqcc',
    version: core?._version || core?.version || 'unknown',
  };

  return { ok: true, weights, cutoffs, meta };
}

export async function loadLbqConfigOnce() {
  try {
    const { ok, weights, cutoffs, meta } = await fetchUnified();
    if (!ok) return { ok: false, reason: 'lbqcc-failed' };

    // Skip update αν έχουμε ήδη πιο «φρέσκο» config στη μνήμη
    const incomingTs = parseDateSafe(meta.generatedAt);
    const currentTs =
      typeof window !== 'undefined' &&
      window.__LBQ_WEIGHTS_META__ &&
      parseDateSafe(window.__LBQ_WEIGHTS_META__.generatedAt);

    if (currentTs && incomingTs && incomingTs <= currentTs) {
      return { ok: true, skipped: true, source: 'lbqcc', reason: 'older-or-same-config' };
    }

    if (typeof window !== 'undefined') {
      window.__LBQ_WEIGHTS__ = weights;
      window.__LBQ_CUTOFFS__ = cutoffs;
      window.__LBQ_WEIGHTS_META__ = meta;
    }

    return {
      ok: true,
      updated: true,
      source: 'lbqcc',
      weights,
      cutoffs,
      meta,
    };
  } catch (err) {
    // Fallback: γράφουμε ασφαλή defaults για να μη «σπάσει» το UI
    if (typeof window !== 'undefined') {
      window.__LBQ_WEIGHTS__ = { ...DEFAULT_WEIGHTS };
      window.__LBQ_CUTOFFS__ = { ...DEFAULT_CUTOFFS };
      window.__LBQ_WEIGHTS_META__ = {
        generatedAt: null,
        source: 'fallback',
        version: 'unknown',
      };
    }
    return { ok: false, reason: String(err || 'error'), fallback: true };
  }
}