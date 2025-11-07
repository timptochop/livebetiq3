// src/ai/modelClient.js
import { setCutoffsRuntime } from './adaptTuner';

const MODEL_URL = process.env.REACT_APP_MODEL_URL || '/api/lbqcc';
const CACHE_KEY = 'LBQ_MODEL_CUTOFFS_CACHE';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AUTO_REFRESH_MS = 10 * 60 * 1000;

function normalizeCutoffs(src) {
  if (!src || typeof src !== 'object') return null;

  const thrSafe =
    typeof src.thrSafe === 'number' ? src.thrSafe :
    typeof src.safeConf === 'number' ? src.safeConf :
    typeof src.minSAFE === 'number' ? src.minSAFE : null;

  const thrRisky =
    typeof src.thrRisky === 'number' ? src.thrRisky :
    typeof src.riskyConf === 'number' ? src.riskyConf :
    typeof src.minRISKY === 'number' ? src.minRISKY : null;

  const minEV = typeof src.minEV === 'number' ? src.minEV : null;

  if (thrSafe == null && thrRisky == null && minEV == null) return null;

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
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), cutoffs }));
  } catch {}
}

async function loadFromUnifiedEndpoint() {
  const res = await fetch(`${MODEL_URL}?mode=config&ts=${Date.now()}`, {
    method: 'GET',
    headers: { 'cache-control': 'no-cache' },
  });

  if (!res.ok) throw new Error('lbqcc-not-ok-' + res.status);

  const json = await res.json();
  const payload =
    json && json.ok && json.data && typeof json.data === 'object' ? json.data : json;

  const cut = normalizeCutoffs(payload);

  if (cut) {
    return { ok: true, cutoffs: cut, source: 'lbqcc-config', raw: json };
  }

  return { ok: true, cutoffs: null, source: 'lbqcc-weights-only', raw: json };
}

export async function loadModelAndApply() {
  try {
    const r = await loadFromUnifiedEndpoint();

    if (r.ok && r.cutoffs) {
      setCutoffsRuntime(r.cutoffs);
      writeCache(r.cutoffs);
      console.log('[LBQ] Model cutoffs loaded:', r.cutoffs, '(source:', r.source + ')');
      return { ok: true, cutoffs: r.cutoffs, source: r.source, raw: r.raw };
    }

    if (r.ok && !r.cutoffs) {
      const cached = readCache();
      if (cached) {
        setCutoffsRuntime(cached);
        console.log('[LBQ] Using cached cutoffs after weights-only response');
        return { ok: true, cutoffs: cached, source: 'cache-after-weights-only' };
      }
      console.warn('[LBQ] No cutoffs (weights-only) and no cache available');
      return { ok: true, cutoffs: null, source: r.source };
    }
  } catch (err) {
    console.warn('[LBQ] Unified config fetch failed:', err?.message || err);
  }

  const cached = readCache();
  if (cached) {
    setCutoffsRuntime(cached);
    console.log('[LBQ] Loaded cutoffs from cache (network failed)');
    return { ok: true, cutoffs: cached, source: 'cache' };
  }

  console.error('[LBQ] No cutoffs available (no network, no cache)');
  return { ok: false, reason: 'no-cutoffs' };
}

if (typeof window !== 'undefined') {
  setInterval(() => {
    loadModelAndApply()
      .then((r) => {
        console.log('[LBQ] Auto-refreshed model', r?.cutoffs || '(no-cutoffs)', 'source:', r?.source);
      })
      .catch(() => {});
  }, AUTO_REFRESH_MS);
}