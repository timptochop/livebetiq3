// src/ai/modelClient.js
import { setCutoffsRuntime } from './adaptTuner';

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

function normalizeCutoffs(src) {
  if (!src || typeof src !== 'object') return null;

  // υποστηρίζουμε και παλιά και νέα σχήματα
  let thrSafe =
    typeof src.thrSafe === 'number' ? src.thrSafe :
    typeof src.safeConf === 'number' ? src.safeConf :
    typeof src.minSAFE === 'number' ? src.minSAFE : null;

  let thrRisky =
    typeof src.thrRisky === 'number' ? src.thrRisky :
    typeof src.riskyConf === 'number' ? src.riskyConf :
    typeof src.minRISKY === 'number' ? src.minRISKY : null;

  if (thrSafe == null && thrRisky == null) return null;
  const out = {};
  if (thrSafe != null) out.thrSafe = thrSafe;
  if (thrRisky != null) out.thrRisky = thrRisky;
  return out;
}

export async function loadModelAndApply() {
  try {
    const base = modelUrl();
    if (!base) return { ok: false, reason: 'no-url' };

    const url = base.includes('?') ? `${base}&model=1` : `${base}?model=1`;
    const headers = {};
    const secret = modelSecret();
    if (secret) headers['X-LBQ-SECRET'] = secret;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) return { ok: false, reason: `http-${res.status}` };

    const j = await res.json();

    // αποδοχή είτε {model:{...}} είτε flat {...} είτε {cutoffs:{...}}
    const candidate =
      (j && j.model) ? j.model :
      (j && j.cutoffs) ? j.cutoffs :
      j;

    const cut = normalizeCutoffs(candidate);
    if (cut) {
      setCutoffsRuntime(cut);               // ενημέρωση runtime
      return { ok: true, cutoffs: cut };
    }

    return { ok: false, reason: 'no-cutoffs-in-response', raw: j };
  } catch (err) {
    return { ok: false, reason: 'fetch-failed', error: String(err) };
  }
}