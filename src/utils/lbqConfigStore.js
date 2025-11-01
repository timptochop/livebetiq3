// src/utils/lbqConfigStore.js
import fetchLbqConfig from './fetchLbqConfig';

const DEFAULT_CFG = {
  ev: 0.3,
  confidence: 0.25,
  momentum: 0.15,
  drift: 0.1,
  surface: 0.1,
  form: 0.1,
  _generatedAt: null,
  _version: 'v5.0-local',
  _source: 'local-default',
};

let currentConfig = { ...DEFAULT_CFG };
let lastFetchTs = 0;
const MIN_FETCH_INTERVAL_MS = 5 * 60 * 1000; // 5 λεπτά

export function getLbqConfig() {
  return currentConfig;
}

export async function initLbqConfig(force = false) {
  const now = Date.now();
  if (!force && now - lastFetchTs < MIN_FETCH_INTERVAL_MS) {
    return currentConfig;
  }

  try {
    const cfg = await fetchLbqConfig();
    currentConfig = {
      ev: Number(cfg.ev ?? DEFAULT_CFG.ev),
      confidence: Number(cfg.confidence ?? DEFAULT_CFG.confidence),
      momentum: Number(cfg.momentum ?? DEFAULT_CFG.momentum),
      drift: Number(cfg.drift ?? DEFAULT_CFG.drift),
      surface: Number(cfg.surface ?? DEFAULT_CFG.surface),
      form: Number(cfg.form ?? DEFAULT_CFG.form),
      _generatedAt: cfg._generatedAt || new Date().toISOString(),
      _version: cfg._version || DEFAULT_CFG._version,
      _source: cfg._source || 'lbq-config',
    };
    lastFetchTs = now;
    // eslint-disable-next-line no-console
    console.log('[LBQ] config updated from GAS:', currentConfig);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[LBQ] using DEFAULT CFG (fetch failed)', err);
    currentConfig = { ...DEFAULT_CFG };
  }

  return currentConfig;
}