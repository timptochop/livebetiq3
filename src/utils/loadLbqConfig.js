// src/utils/loadLbqConfig.js

import {
  loadLbqConfig as clientLoad,
  getLbqConfig as clientGet
} from './lbqConfigClient';

export async function loadLbqConfigOnce() {
  const cfg = await clientLoad();

  if (typeof window !== 'undefined') {
    window.__LBQ_CONFIG__ = cfg;
  }

  return {
    ok: true,
    config: cfg
  };
}

export async function loadLbqConfig() {
  return clientLoad();
}

export function getLbqConfig() {
  return clientGet();
}

export default loadLbqConfigOnce;