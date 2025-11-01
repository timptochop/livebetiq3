// src/utils/loadLbqConfig.js
// v5.0-phase1-react-pull
// Safe helper: reads Google Apps Script JSON and updates window.__LBQ_WEIGHTS__
// without touching the rest of the app.

const LBQ_CONFIG_URL =
  'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

const DEFAULT_WEIGHTS = {
  ev: 0.3,
  confidence: 0.25,
  momentum: 0.15,
  drift: 0.1,
  surface: 0.1,
  form: 0.1,
};

function parseDateSafe(v) {
  if (!v) return 0;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

export async function loadLbqConfigOnce() {
  try {
    const res = await fetch(LBQ_CONFIG_URL, {
      method: 'GET',
      headers: {
        'cache-control': 'no-cache',
      },
    });

    if (!res.ok) {
      // keep existing weights
      return {
        ok: false,
        reason: 'fetch-failed',
      };
    }

    const data = await res.json();
    if (!data || data.ok !== true) {
      return {
        ok: false,
        reason: 'bad-payload',
      };
    }

    const incomingTs = parseDateSafe(data._generatedAt);
    const currentTs =
      typeof window !== 'undefined' &&
      window.__LBQ_WEIGHTS_META__ &&
      parseDateSafe(window.__LBQ_WEIGHTS_META__.generatedAt);

    // if we already have newer config, do nothing
    if (currentTs && incomingTs && incomingTs <= currentTs) {
      return {
        ok: true,
        skipped: true,
        reason: 'older-or-same-config',
      };
    }

    const nextWeights = {
      ev: Number(data.ev ?? DEFAULT_WEIGHTS.ev),
      confidence: Number(data.confidence ?? DEFAULT_WEIGHTS.confidence),
      momentum: Number(data.momentum ?? DEFAULT_WEIGHTS.momentum),
      drift: Number(data.drift ?? DEFAULT_WEIGHTS.drift),
      surface: Number(data.surface ?? DEFAULT_WEIGHTS.surface),
      form: Number(data.form ?? DEFAULT_WEIGHTS.form),
    };

    if (typeof window !== 'undefined') {
      window.__LBQ_WEIGHTS__ = nextWeights;
      window.__LBQ_WEIGHTS_META__ = {
        generatedAt: data._generatedAt || null,
        source: data._source || 'lbq-config',
        version: data._version || 'unknown',
      };
    }

    return {
      ok: true,
      updated: true,
      weights: nextWeights,
      meta: {
        generatedAt: data._generatedAt || null,
        version: data._version || 'unknown',
      },
    };
  } catch (err) {
    // fail soft
    return {
      ok: false,
      reason: 'exception',
      error: String(err),
    };
  }
}