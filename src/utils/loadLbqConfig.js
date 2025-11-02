// src/utils/loadLbqConfig.js
const PROXY_URL = '/api/lbq-config';
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

async function fetchFromProxy() {
  const res = await fetch(PROXY_URL, {
    method: 'GET',
    headers: {
      'cache-control': 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error('proxy-failed-' + res.status);
  }
  const j = await res.json();
  const payload =
    j && j.ok && j.data && typeof j.data === 'object' ? j.data : j;
  return payload;
}

async function fetchFromGas() {
  const res = await fetch(LBQ_CONFIG_URL, {
    method: 'GET',
    headers: {
      'cache-control': 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error('gas-failed-' + res.status);
  }
  const data = await res.json();
  return data;
}

export async function loadLbqConfigOnce() {
  let data = null;

  try {
    data = await fetchFromProxy();
  } catch {
    try {
      data = await fetchFromGas();
    } catch (err) {
      return {
        ok: false,
        reason: 'fetch-failed',
        error: String(err),
      };
    }
  }

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
}