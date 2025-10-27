// src/ai/modelClient.js
import { setCutoffsRuntime } from './adaptTuner';

const CACHE_KEY = 'LBQ_CUTOFFS_CACHE';
const CACHE_TS  = 'LBQ_CUTOFFS_TS';
const CACHE_TTL_HOURS = 12;

function modelUrl() {
  try {
    if (typeof window !== 'undefined' && window.__LBQ_WEBAPP_URL) return String(window.__LBQ_WEBAPP_URL);
    return String(process.env.REACT_APP_MODEL_URL || '');
  } catch {
    return '';
  }
}

function modelSecret() {
  try {
    if (typeof window !== 'undefined' && window.__LBQ_SECRET) return String(window.__LBQ_SECRET);
    return String(process.env.REACT_APP_LBQ_SECRET || '');
  } catch {
    return '';
  }
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const ts  = Number(localStorage.getItem(CACHE_TS) || 0);
    if (!raw || !ts) return null;
    const ageH = (Date.now() - ts) / (1000 * 60 * 60);
    if (ageH > CACHE_TTL_HOURS) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(cut) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cut));
    localStorage.setItem(CACHE_TS, String(Date.now()));
  } catch {}
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
    typeof src.minEV === 'number' ? src.minEV :
    typeof src.evMin === 'number' ? src.evMin : null;

  if (thrSafe == null && thrRisky == null && minEV == null) return null;

  const out = {};
  if (thrSafe  != null) out.thrSafe  = thrSafe;
  if (thrRisky != null) out.thrRisky = thrRisky;
  if (minEV    != null) out.minEV    = minEV;
  return out;
}

/**
 * Κύρια ρουτίνα φόρτωσης:
 * - Προσπαθεί fetch από GAS (?model=1) με secret ως query param
 * - Αν πετύχει: apply + cache
 * - Αν αποτύχει: fallback σε cache (αν είναι φρέσκια)
 */
export async function loadModelAndApply() {
  const base = modelUrl();
  if (!base) {
    // fallback σε cache αν υπάρχει
    const cached = readCache();
    if (cached) {
      setCutoffsRuntime(cached);
      return { ok: true, cutoffs: cached, from: 'cache-no-url' };
    }
    return { ok: false, reason: 'no-url' };
  }

  // χτίζουμε URL με model=1 & secret=...
  const secret = modelSecret();
  const u = new URL(base);
  u.searchParams.set('model', '1');
  if (secret) u.searchParams.set('secret', secret);

  try {
    const res = await fetch(u.toString(), { method: 'GET' });
    if (!res.ok) throw new Error('http-' + res.status);
    const j = await res.json();

    const candidate =
      (j && j.model)   ? j.model :
      (j && j.cutoffs) ? j.cutoffs :
      j;

    const cut = normalizeCutoffs(candidate);
    if (!cut) {
      // αν δεν έχει cutoffs, δοκίμασε cache
      const cached = readCache();
      if (cached) {
        setCutoffsRuntime(cached);
        return { ok: true, cutoffs: cached, from: 'cache-no-cutoffs' };
      }
      return { ok: false, reason: 'no-cutoffs-in-response', raw: j };
    }

    setCutoffsRuntime(cut);
    writeCache(cut);
    return { ok: true, cutoffs: cut, from: 'network' };
  } catch (err) {
    // network fail → fallback σε cache
    const cached = readCache();
    if (cached) {
      setCutoffsRuntime(cached);
      return { ok: true, cutoffs: cached, from: 'cache-fallback', error: String(err) };
    }
    return { ok: false, reason: 'fetch-failed', error: String(err) };
  }
}