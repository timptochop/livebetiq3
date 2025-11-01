// src/utils/fetchLbqConfig.js
const LBQ_CONFIG_URL =
  'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

const FALLBACK_CONFIG = {
  ev: 0.3,
  confidence: 0.25,
  momentum: 0.15,
  drift: 0.1,
  surface: 0.1,
  form: 0.1,
  _generatedAt: null,
  _source: 'fallback',
  _rowsUsed: 0,
  _version: 'v5.0-fallback',
  _fetchedAt: new Date().toISOString(),
};

function normalizeNumber(v, defVal) {
  const n = Number(v);
  return Number.isFinite(n) ? n : defVal;
}

export default async function fetchLbqConfig() {
  try {
    const resp = await fetch(LBQ_CONFIG_URL, {
      method: 'GET',
      // για GAS καλό είναι να είναι no-cache για να μην κολλάμε σε παλιό JSON
      cache: 'no-store',
    });

    if (!resp.ok) {
      console.warn('[LBQ] fetchLbqConfig: non-200', resp.status);
      return { ...FALLBACK_CONFIG, _source: 'fallback-non200' };
    }

    const data = await resp.json();

    // περιμένουμε {
    //   ev, confidence, momentum, drift, surface, form,
    //   _generatedAt, _source, _rowsUsed, _version, ok, source
    // }

    const cfg = {
      ev: normalizeNumber(data.ev, FALLBACK_CONFIG.ev),
      confidence: normalizeNumber(data.confidence, FALLBACK_CONFIG.confidence),
      momentum: normalizeNumber(data.momentum, FALLBACK_CONFIG.momentum),
      drift: normalizeNumber(data.drift, FALLBACK_CONFIG.drift),
      surface: normalizeNumber(data.surface, FALLBACK_CONFIG.surface),
      form: normalizeNumber(data.form, FALLBACK_CONFIG.form),
      _generatedAt: data._generatedAt || null,
      _source: data.source || data._source || 'lbq-config',
      _rowsUsed: normalizeNumber(data._rowsUsed, 0),
      _version: data._version || 'v5.0-phase1',
      _fetchedAt: new Date().toISOString(),
    };

    return cfg;
  } catch (err) {
    console.error('[LBQ] fetchLbqConfig: error', err);
    return { ...FALLBACK_CONFIG, _source: 'fallback-error' };
  }
}