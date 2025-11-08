// src/utils/fetchAdaptiveWeights.js

// HARD-LOCK: ΠΑΝΤΑ μέσω Vercel proxy
const MODEL_URL = '/api/lbqcc';

const DEFAULT_WEIGHTS = {
  ev: 0.3,
  confidence: 0.25,
  momentum: 0.15,
  drift: 0.1,
  surface: 0.1,
  form: 0.1,
};

function n(v, d) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

export default async function fetchAdaptiveWeights() {
  const r = await fetch(`${MODEL_URL}?mode=config&ts=${Date.now()}`, {
    method: 'GET',
    headers: { 'cache-control': 'no-cache' },
  });
  if (!r.ok) throw new Error(`lbqcc-${r.status}`);

  const j = await r.json();
  const core = j && j.ok && j.data && typeof j.data === 'object' ? j.data : j;

  const weights = {
    ev: n(core?.ev, DEFAULT_WEIGHTS.ev),
    confidence: n(core?.confidence, DEFAULT_WEIGHTS.confidence),
    momentum: n(core?.momentum, DEFAULT_WEIGHTS.momentum),
    drift: n(core?.drift, DEFAULT_WEIGHTS.drift),
    surface: n(core?.surface, DEFAULT_WEIGHTS.surface),
    form: n(core?.form, DEFAULT_WEIGHTS.form),
  };

  if (typeof window !== 'undefined') {
    window.__LBQ_WEIGHTS__ = weights;
    window.__LBQ_WEIGHTS_META__ = {
      generatedAt: core?._generatedAt || core?.generatedAt || null,
      source: core?._source || 'lbqcc',
      version: core?._version || core?.version || 'unknown',
    };
  }

  return { ok: true, weights };
}