// src/utils/fetchLbqConfig.js
const LBQ_CONFIG_URL =
  'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

// localStorage key so we don't collide with other parts of the app
const STORAGE_KEY = 'lbq_config_snapshot_v5';

/**
 * Coerces any value to number, with fallback.
 */
function toNum(v, defVal = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : defVal;
}

/**
 * Returns the last saved snapshot from localStorage (or null).
 */
function getSavedSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Saves snapshot to localStorage.
 */
function saveSnapshot(snap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch (_) {
    // ignore
  }
}

/**
 * Compares remote vs local by _generatedAt or _version.
 */
function isNewer(remote, local) {
  if (!remote) return false;
  if (!local) return true;

  // prefer version bump first
  if (remote._version && remote._version !== local._version) return true;

  // then compare timestamps
  if (remote._generatedAt && local._generatedAt) {
    const r = Date.parse(remote._generatedAt);
    const l = Date.parse(local._generatedAt);
    if (!Number.isNaN(r) && !Number.isNaN(l)) {
      return r > l;
    }
  }

  return false;
}

/**
 * Normalizes the config from GAS into a stable object.
 */
function normalizeConfig(obj) {
  if (!obj || typeof obj !== 'object') {
    return {
      ev: 0.3,
      confidence: 0.25,
      momentum: 0.15,
      drift: 0.1,
      surface: 0.1,
      form: 0.1,
      _generatedAt: new Date().toISOString(),
      _source: 'fallback',
      _rowsUsed: 0,
      _version: 'v5.0-fallback',
    };
  }

  return {
    ev: toNum(obj.ev, 0.3),
    confidence: toNum(obj.confidence, 0.25),
    momentum: toNum(obj.momentum, 0.15),
    drift: toNum(obj.drift, 0.1),
    surface: toNum(obj.surface, 0.1),
    form: toNum(obj.form, 0.1),
    _generatedAt: obj._generatedAt || new Date().toISOString(),
    _source: obj._source || 'lbq-config',
    _rowsUsed: toNum(obj._rowsUsed, 0),
    _version: obj._version || 'v5.0-phase1',
  };
}

/**
 * Main fetcher.
 * - fetches remote
 * - normalizes
 * - compares with local
 * - optionally updates local
 */
export default async function fetchLbqConfig() {
  const localSnap = getSavedSnapshot();

  try {
    const res = await fetch(LBQ_CONFIG_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const json = await res.json();
    const remoteConf = normalizeConfig(json);

    const newer = isNewer(remoteConf, localSnap);

    if (newer) {
      saveSnapshot(remoteConf);
    }

    return {
      ok: true,
      config: remoteConf,
      hasNew: newer,
      from: newer ? 'remote' : 'cache',
    };
  } catch (err) {
    // if remote fails, return the last good one
    if (localSnap) {
      return {
        ok: true,
        config: normalizeConfig(localSnap),
        hasNew: false,
        from: 'cache-fallback',
      };
    }

    // absolute fallback
    return {
      ok: false,
      config: normalizeConfig(null),
      hasNew: false,
      from: 'hard-fallback',
      error: String(err),
    };
  }
}