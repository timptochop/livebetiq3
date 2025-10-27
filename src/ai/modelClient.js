// src/ai/modelClient.js
import { setCutoffsRuntime } from './adaptTuner';

const CACHE_KEY = 'LBQ_MODEL_CUTOFFS_CACHE';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function modelUrl() {
  try {
    if (typeof window !== 'undefined' && window.__LBQ_WEBAPP_URL) return String(window.__LBQ_WEBAPP_URL);
    return String(process.env.REACT_APP_MODEL_URL || '');
  } catch { return ''; }
}

function modelSecret() {
  try {
    if (typeof window !== 'undefined' && window.__LBQ_SECRET) return String(window.__LBQ_SECRET);
    return String(process.env.REACT_APP_LBQ_SECRET || '');
  } catch { return ''; }
}

function normalizeCutoffs(src) {
  if (!src || typeof src !== 'object') return null;
  let thrSafe =
    typeof src.thrSafe === 'number' ? src.thrSafe :
    typeof src.safeConf === 'number' ? src.safeConf :
    typeof src.minSAFE === 'number' ? src.minSAFE : null;
  let thrRisky =
    typeof src.thrRisky === 'number' ? src.thrRisky :
    typeof src.riskyConf === 'number' ? src.riskyConf :
    typeof src.minRISKY === 'number' ? src.minRISKY : null;
  let minEV =
    typeof src.minEV === 'number' ? src.minEV : null;
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
  } catch { return null; }
}

function writeCache(cutoffs) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), cutoffs }));
  } catch {}
}

export async function loadModelAndApply() {
  try {
    const base = modelUrl();
    if (!base) return { ok: false, reason: 'no-url' };

    const secret = modelSecret();
    const url = (() => {
      const u = base.includes('?') ? `${base}&model=1` : `${base}?model=1`;
      return secret ? `${u}&secret=${encodeURIComponent(secret)}` : u;
    })();

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      const cached = readCache();
      if (cached) { setCutoffsRuntime(cached); return { ok: true, cutoffs: cached, source: 'cache', http: res.status }; }
      return { ok: false, reason: `http-${res.status}` };
    }

    const j = await res.json();
    const candidate = (j && j.model) ? j.model : (j && j.cutoffs) ? j.cutoffs : j;
    const cut = normalizeCutoffs(candidate);
    if (cut) {
      setCutoffsRuntime(cut);
      writeCache(cut);
      return { ok: true, cutoffs: cut, source: 'network' };
    }

    const cached = readCache();
    if (cached) { setCutoffsRuntime(cached); return { ok: true, cutoffs: cached, source: 'cache', reason: 'no-cutoffs-in-response' }; }
    return { ok: false, reason: 'no-cutoffs-in-response', raw: j };
  } catch (err) {
    const cached = readCache();
    if (cached) { setCutoffsRuntime(cached); return { ok: true, cutoffs: cached, source: 'cache', reason: 'fetch-failed' }; }
    return { ok: false, reason: 'fetch-failed', error: String(err) };
  }
}