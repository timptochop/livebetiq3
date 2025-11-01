// src/utils/fetchLbqConfig.js
const LBQ_CONFIG_URL = 'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';
const STORAGE_KEY = 'lbq_config_v1';
const STORAGE_VER_KEY = 'lbq_config_version';

function getLocalConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const ver = localStorage.getItem(STORAGE_VER_KEY);
    if (!raw) return { ok: false, data: null, version: ver || '' };
    const data = JSON.parse(raw);
    return { ok: true, data, version: ver || '' };
  } catch (_) {
    return { ok: false, data: null, version: '' };
  }
}

function saveLocalConfig(obj, version) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    localStorage.setItem(STORAGE_VER_KEY, version || '');
  } catch (_) {
  }
}

export default async function fetchLbqConfig(force = false) {
  const local = getLocalConfig();
  if (!force && local.ok) {
    return {
      ok: true,
      data: local.data,
      version: local.version,
      changed: false,
      source: 'local'
    };
  }

  let res;
  try {
    res = await fetch(LBQ_CONFIG_URL, { method: 'GET' });
  } catch (err) {
    if (local.ok) {
      return {
        ok: true,
        data: local.data,
        version: local.version,
        changed: false,
        source: 'local-fallback'
      };
    }
    return {
      ok: false,
      data: null,
      version: '',
      changed: false,
      source: 'network-error'
    };
  }

  if (!res.ok) {
    if (local.ok) {
      return {
        ok: true,
        data: local.data,
        version: local.version,
        changed: false,
        source: 'local-fallback'
      };
    }
    return {
      ok: false,
      data: null,
      version: '',
      changed: false,
      source: 'bad-status'
    };
  }

  let json;
  try {
    json = await res.json();
  } catch (_) {
    if (local.ok) {
      return {
        ok: true,
        data: local.data,
        version: local.version,
        changed: false,
        source: 'local-fallback'
      };
    }
    return {
      ok: false,
      data: null,
      version: '',
      changed: false,
      source: 'bad-json'
    };
  }

  const remoteVer = typeof json._version === 'string' ? json._version : '';
  const localVer = local.version || '';
  const changed = remoteVer && remoteVer !== localVer;

  saveLocalConfig(json, remoteVer);

  return {
    ok: true,
    data: json,
    version: remoteVer,
    changed,
    source: 'remote'
  };
}