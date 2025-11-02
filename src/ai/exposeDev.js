// src/ai/exposeDev.js
import { calculateEV, estimateConfidence, generateLabel, generateNote } from './aiEngine';

const PROXY_URL = '/api/lbq-config';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxWd_BhtjqE78k0pzgAOv1PAG0-F3QsuUy6sU-TChOgyKCCjM0nrebsAd068P3GFYI/exec';

async function tryProxy(mode) {
  const url = mode ? `${PROXY_URL}?mode=${encodeURIComponent(mode)}` : PROXY_URL;
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'cache-control': 'no-cache' },
  });
  if (!res.ok) {
    throw new Error('proxy-' + res.status);
  }
  return res.json();
}

async function tryGas(mode) {
  const url = mode ? `${GAS_URL}?mode=${encodeURIComponent(mode)}` : GAS_URL;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error('gas-' + res.status);
  }
  return res.json();
}

async function lbqPing() {
  try {
    const j = await tryProxy('ping');
    console.log('[LBQ][dev] ping via proxy:', j);
    return j;
  } catch (e) {
    const j2 = await tryGas('ping');
    console.log('[LBQ][dev] ping via GAS:', j2);
    return j2;
  }
}

async function lbqRecalc() {
  try {
    const j = await tryProxy('recalc');
    console.log('[LBQ][dev] recalc via proxy:', j);
    return j;
  } catch (e) {
    const j2 = await tryGas('recalc');
    console.log('[LBQ][dev] recalc via GAS:', j2);
    return j2;
  }
}

async function lbqFetchConfig() {
  try {
    const j = await tryProxy();
    console.log('[LBQ][dev] config via proxy:', j);
    return j;
  } catch (e) {
    const j2 = await tryGas();
    console.log('[LBQ][dev] config via GAS:', j2);
    return j2;
  }
}

if (typeof window !== 'undefined') {
  window.LBQ_ai = { calculateEV, estimateConfidence, generateLabel, generateNote };
  window.__LBQ_PING = lbqPing;
  window.__LBQ_RECALC = lbqRecalc;
  window.__LBQ_FETCH_CONFIG = lbqFetchConfig;
  console.log('[LBQ][dev] helpers ready (proxy-first)');
}