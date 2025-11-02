// src/ai/modelClient.js
// v5.0-phase1e – proxy-first, tolerant-to-weights, GAS-fallback, with localStorage cache
import { setCutoffsRuntime } from './adaptTuner';

const CACHE_KEY = 'LBQ_MODEL_CUTOFFS_CACHE';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const AUTO_REFRESH_MS = 10 * 60 * 1000; // 10min
const PROXY_URL = '/api/lbq-config'; // same origin → no CORS

function modelUrl() {
  try {
    if (typeof window !== 'undefined' && window.__LBQ_WEBAPP_URL) {
      return String(window.__LBQ_WEBAPP_URL);
    }
    return String(process.env.REACT_APP_MODEL_URL || '');
  } catch {
    return '';
  }
}

function modelSecret() {
  try {
    if (typeof window !== 'undefined' && window.__LBQ_SECRET) {
      return String(window.__LBQ_SECRET);
    }
    return String(process.env.REACT_APP_LBQ_SECRET || '');
  } catch {
    return '';
  }
}

function normalizeCutoffs(src) {
  if (!src || typeof src !== 'object') return null;

  let thrSafe =
    typeof src.thrSafe === 'number'
      ? src.thrSafe
      : typeof src.safeConf === 'number'
      ? src.safeConf
      : typeof src.minSAFE === 'number'
      ? src.minSAFE
      : null;

  let thrRisky =
    typeof src.thrRisky === 'number'
      ? src.thrRisky
      : typeof src.riskyConf === 'number'
      ? src.riskyConf
      : typeof src.minRISKY === 'number'
      ? src.minRISKY
      : null;

  let minEV = typeof src.minEV === 'number' ? src.minEV : null;

  const none = thrSafe == null && thrRisky == null && minEV == null;
  if (none) return null;

  const out = {};
  if (thrSafe != null) out.thrSafe = thrSafe;
  if (thrRisky != null) out.thrRisky = thrRisky;
  if (minEV != null) out.minEV = minEV;
  return out;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object') return null;
    if (typeof j.ts !== 'number' || !j.cutoffs) return null;
    if (Date.now() - j.ts > CACHE_TTL_MS) return null;
    return j.cutoffs;
  } catch {
    return null;
  }
}

function writeCache(cutoffs) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ts: Date.now(), cutoffs })
    );
  } catch {}
}

// 1) proxy (Vercel) – μπορεί να δώσει cutoffs ή μόνο weights
async function loadFromProxy() {
  const res = await fetch(PROXY_URL, {
    method: 'GET',
    headers: {
      'cache-control': 'no-cache',
    },
  });

  if (!res.ok) {
    throw new Error('proxy-not-ok-' + res.status);
  }

  const json = await res.json();

  const payload =
    json && json.ok && json.data && typeof json.data === 'object'
      ? json.data
      : json;

  const cut = normalizeCutoffs(payload);

  if (cut) {
    return {
      ok: true,
      cutoffs: cut,
      source: 'proxy-cutoffs',
      raw: json,
    };
  }

  // εδώ είμαστε στην περίπτωση που έχεις τώρα: μόνο weights
  return {
    ok: true,
    cutoffs: null,
    source: 'proxy-weights-only',
    raw: json,
  };
}

// 2) original GAS / direct
async function loadFromGasOrDirect() {
  const base = modelUrl();
  if (!base) return { ok: false, reason: 'no-url' };

  const secret = modelSecret();
  const url = (() => {
    const u = base.includes('?') ? `${base}&model=1` : `${base}?model=1`;
    return secret ? `${u}&secret=${encodeURIComponent(secret)}` : u;
  })();

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    return { ok: false, reason: `http-${res.status}` };
  }

  const j = await res.json();
  const candidate =
    j && j.model
      ? j.model
      : j && j.cutoffs
      ? j.cutoffs
      : j;

  const cut = normalizeCutoffs(candidate);
  if (!cut) {
    return { ok: false, reason: 'no-cutoffs-in-response', raw: j };
  }

  return { ok: true, cut, raw: j };
}

export async function loadModelAndApply() {
  // 1. proxy-first
  try {
    const r = await loadFromProxy();

    if (r.ok && r.cutoffs) {
      setCutoffsRuntime(r.cutoffs);
      writeCache(r.cutoffs);
      return { ok: true, cutoffs: r.cutoffs, source: r.source, raw: r.raw };
    }

    if (r.ok && !r.cutoffs) {
      const cached = readCache();
      if (cached) {
        setCutoffsRuntime(cached);
        return {
          ok: true,
          cutoffs: cached,
          source: 'cache-after-proxy-weights',
        };
      }
      return {
        ok: true,
        cutoffs: null,
        source: r.source,
      };
    }
  } catch (_) {
    // continue with GAS
  }

  // 2. GAS / direct
  try {
    const r = await loadFromGasOrDirect();
    if (r.ok && r.cut) {
      setCutoffsRuntime(r.cut);
      writeCache(r.cut);
      return {
        ok: true,
        cutoffs: r.cut,
        source: 'network',
        raw: r.raw || null,
      };
    }

    const cached = readCache();
    if (cached) {
      setCutoffsRuntime(cached);
      return {
        ok: true,
        cutoffs: cached,
        source: 'cache',
        reason: r.reason || 'network-failed',
      };
    }

    return {
      ok: true,
      cutoffs: null,
      source: 'gas-no-cutoffs',
    };
  } catch (err) {
    const cached = readCache();
    if (cached) {
      setCutoffsRuntime(cached);
      return {
        ok: true,
        cutoffs: cached,
        source: 'cache',
        reason: 'fetch-exception',
      };
    }
    return {
      ok: false,
      reason: 'fetch-exception',
      error: String(err),
    };
  }
}

// auto-refresh
if (typeof window !== 'undefined') {
  setInterval(() => {
    loadModelAndApply()
      .then((r) => {
        console.log(
          '[LBQ] Auto-refreshed model',
          r?.cutoffs || '(no-cutoffs)',
          'source:',
          r?.source
        );
      })
      .catch(() => {});
  }, AUTO_REFRESH_MS);
}