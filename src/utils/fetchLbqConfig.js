// src/utils/loadLbqConfig.js
// v5.0-phase1-react-pull + vercel-proxy-first
// 1. προσπαθεί να διαβάσει από /api/lbq-config (ίδιο origin, χωρίς CORS)
// 2. αν αποτύχει → fallback στο Apps Script URL
// 3. γράφει σε window.__LBQ_WEIGHTS__ χωρίς να επηρεάζει άλλο κώδικα

const VERCEL_PROXY_URL = '/api/lbq-config';

const GAS_URL =
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

function normalizePayload(data, sourceHint) {
  if (!data) return null;
  // περιπτώσεις:
  // 1) { ok:true, data:{ev:...} }  ← vercel proxy
  // 2) { ok:true, ev:..., _generatedAt:... } ← GAS
  // 3) { ev:..., ... } ← raw
  let core = null;

  if (data.ok === true && data.data && typeof data.data === 'object') {
    core = data.data;
  } else if (data.ok === true) {
    core = data;
  } else if (data.ev !== undefined) {
    core = data;
  }

  if (!core) return null;

  return {
    ev: Number(core.ev ?? DEFAULT_WEIGHTS.ev),
    confidence: Number(core.confidence ?? DEFAULT_WEIGHTS.confidence),
    momentum: Number(core.momentum ?? DEFAULT_WEIGHTS.momentum),
    drift: Number(core.drift ?? DEFAULT_WEIGHTS.drift),
    surface: Number(core.surface ?? DEFAULT_WEIGHTS.surface),
    form: Number(core.form ?? DEFAULT_WEIGHTS.form),
    generatedAt: core._generatedAt || core.generatedAt || null,
    source: core._source || sourceHint || 'lbq-config',
    version: core._version || core.version || 'unknown',
  };
}

async function fetchFromProxy() {
  const res = await fetch(VERCEL_PROXY_URL, {
    method: 'GET',
    headers: {
      'cache-control': 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error('proxy-not-ok');
  }
  const data = await res.json();
  const norm = normalizePayload(data, 'vercel-edge-proxy');
  if (!norm) {
    throw new Error('proxy-bad-payload');
  }
  return norm;
}

async function fetchFromGas() {
  const res = await fetch(GAS_URL, {
    method: 'GET',
    headers: {
      'cache-control': 'no-cache',
    },
  });
  if (!res.ok) {
    throw new Error('gas-not-ok');
  }
  const data = await res.json();
  const norm = normalizePayload(data, 'gas-direct');
  if (!norm) {
    throw new Error('gas-bad-payload');
  }
  return norm;
}

export async function loadLbqConfigOnce() {
  // 1. πήγαινε πρώτα στο Vercel (ίδιο origin → δεν θα δεις CORS)
  let payload = null;
  let used = null;

  try {
    payload = await fetchFromProxy();
    used = 'proxy';
  } catch (e1) {
    // 2. fallback στο GAS – εδώ ΜΠΟΡΕΙ να δεις CORS αν τρέχεις local χωρίς proxy
    try {
      payload = await fetchFromGas();
      used = 'gas';
    } catch (e2) {
      return {
        ok: false,
        reason: 'both-failed',
        proxyErr: String(e1),
        gasErr: String(e2),
      };
    }
  }

  if (!payload) {
    return {
      ok: false,
      reason: 'no-payload',
    };
  }

  // compare με ό,τι έχουμε ήδη στο window
  const incomingTs = parseDateSafe(payload.generatedAt);
  const currentTs =
    typeof window !== 'undefined' &&
    window.__LBQ_WEIGHTS_META__ &&
    parseDateSafe(window.__LBQ_WEIGHTS_META__.generatedAt);

  if (currentTs && incomingTs && incomingTs <= currentTs) {
    return {
      ok: true,
      skipped: true,
      source: used,
      reason: 'older-or-same-config',
    };
  }

  const nextWeights = {
    ev: payload.ev,
    confidence: payload.confidence,
    momentum: payload.momentum,
    drift: payload.drift,
    surface: payload.surface,
    form: payload.form,
  };

  if (typeof window !== 'undefined') {
    window.__LBQ_WEIGHTS__ = nextWeights;
    window.__LBQ_WEIGHTS_META__ = {
      generatedAt: payload.generatedAt,
      source: payload.source || used,
      version: payload.version,
    };
  }

  return {
    ok: true,
    updated: true,
    source: used,
    weights: nextWeights,
    meta: {
      generatedAt: payload.generatedAt,
      version: payload.version,
    },
  };
}