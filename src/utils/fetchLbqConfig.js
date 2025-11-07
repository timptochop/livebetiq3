// src/utils/loadLbqConfig.js
// v5.1-lockdown — unified via /api/lbqcc?mode=config

const PROXY_URL = '/api/lbqcc?mode=config';

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

  let core = null;
  if (data.ok === true && data.data && typeof data.data === 'object') core = data.data;
  else if (data.ok === true) core = data;
  else if (data.ev !== undefined) core = data;

  if (!core) return null;

  return {
    ev: Number(core.ev ?? DEFAULT_WEIGHTS.ev),
    confidence: Number(core.confidence ?? DEFAULT_WEIGHTS.confidence),
    momentum: Number(core.momentum ?? DEFAULT_WEIGHTS.momentum),
    drift: Number(core.drift ?? DEFAULT_WEIGHTS.drift),
    surface: Number(core.surface ?? DEFAULT_WEIGHTS.surface),
    form: Number(core.form ?? DEFAULT_WEIGHTS.form),
    generatedAt: core._generatedAt || core.generatedAt || null,
    source: core._source || sourceHint || 'lbqcc',
    version: core._version || core.version || 'unknown',
  };
}

async function fetchFromProxy() {
  const res = await fetch(PROXY_URL, {
    method: 'GET',
    headers: { 'cache-control': 'no-cache' },
  });
  if (!res.ok) throw new Error('proxy-not-ok-' + res.status);
  const data = await res.json();
  const norm = normalizePayload(data, 'vercel-proxy');
  if (!norm) throw new Error('proxy-bad-payload');
  return norm;
}

export async function loadLbqConfigOnce() {
  let payload = null;
  try {
    payload = await fetchFromProxy();
  } catch (e) {
    return { ok: false, reason: String(e) };
  }

  if (!payload) return { ok: false, reason: 'no-payload' };

  const incomingTs = parseDateSafe(payload.generatedAt);
  const currentTs =
    typeof window !== 'undefined' &&
    window.__LBQ_WEIGHTS_META__ &&
    parseDateSafe(window.__LBQ_WEIGHTS_META__.generatedAt);

  if (currentTs && incomingTs && incomingTs <= currentTs) {
    return { ok: true, skipped: true, source: 'proxy', reason: 'older-or-same-config' };
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
      source: payload.source || 'proxy',
      version: payload.version,
    };
  }

  return {
    ok: true,
    updated: true,
    source: 'proxy',
    weights: nextWeights,
    meta: { generatedAt: payload.generatedAt, version: payload.version },
  };
}