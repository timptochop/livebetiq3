// src/utils/lbqConfigClient.js
// LBQ Config Client v2.0 – fetch thresholds from /api/lbqcc?mode=config
// and expose them to the rest of the app.
//
// This is the single source of truth for SAFE/RISKY thresholds
// on the frontend side.

const DEFAULT_CONFIG = {
  SAFE_MIN_EV: 0.03,
  SAFE_MIN_CONF: 0.58,
  MAX_VOL_SAFE: 0.55,

  RISKY_MIN_EV: 0.01,
  RISKY_MIN_CONF: 0.53,
  MAX_VOL_RISKY: 0.9,

  MIN_ODDS: 1.3,
  MAX_ODDS: 7.5,

  LOG_PREDICTIONS: 1,
  ENGINE_VERSION: 'v3.3'
};

// In-memory cache for the current config
let currentConfig = { ...DEFAULT_CONFIG };
let loaded = false;
let loadingPromise = null;

/**
 * Merge server config into defaults.
 * Any unknown keys from the server are also kept.
 */
function mergeConfig(serverCfg) {
  if (!serverCfg || typeof serverCfg !== 'object') {
    return { ...DEFAULT_CONFIG };
  }

  const cfg = { ...DEFAULT_CONFIG };

  Object.keys(serverCfg).forEach(key => {
    const val = serverCfg[key];
    // Simple numeric coercion where appropriate
    if (typeof DEFAULT_CONFIG[key] === 'number') {
      const asNum = Number(val);
      if (!Number.isNaN(asNum)) {
        cfg[key] = asNum;
      }
    } else {
      cfg[key] = val;
    }
  });

  return cfg;
}

/**
 * Load LBQ config from /api/lbqcc?mode=config.
 * Uses in-memory caching so we don't ping on every call.
 *
 * Usage:
 *   await loadLbqConfig();
 *   const cfg = getLbqConfig();
 */
export async function loadLbqConfig() {
  if (loaded && currentConfig) {
    return currentConfig;
  }

  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    try {
      const url = `/api/lbqcc?mode=config&ts=${Date.now()}`;
      const res = await fetch(url);

      if (!res.ok) {
        console.warn('[LBQ Config] HTTP error', res.status);
        loaded = true;
        currentConfig = { ...DEFAULT_CONFIG };
        return currentConfig;
      }

      const json = await res.json();

      if (!json || typeof json !== 'object') {
        console.warn('[LBQ Config] Invalid JSON payload', json);
        loaded = true;
        currentConfig = { ...DEFAULT_CONFIG };
        return currentConfig;
      }

      if (!json.ok) {
        console.warn('[LBQ Config] Backend returned not-ok', json);
        loaded = true;
        currentConfig = { ...DEFAULT_CONFIG };
        return currentConfig;
      }

      const serverCfg = json.config || {};
      const merged = mergeConfig(serverCfg);

      currentConfig = merged;
      loaded = true;

      console.log('[LBQ Config] Loaded config from backend:', merged);
      return currentConfig;
    } catch (err) {
      console.error('[LBQ Config] Failed to load config:', err);
      loaded = true;
      currentConfig = { ...DEFAULT_CONFIG };
      return currentConfig;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Get the currently loaded config.
 * If loadLbqConfig() has not been awaited yet, this returns defaults.
 */
export function getLbqConfig() {
  if (!loaded || !currentConfig) {
    return { ...DEFAULT_CONFIG };
  }
  return { ...currentConfig };
}

/**
 * Hard reset (for tests / dev only).
 */
export function resetLbqConfigCache() {
  loaded = false;
  loadingPromise = null;
  currentConfig = { ...DEFAULT_CONFIG };
}