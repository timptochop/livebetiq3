// src/ai/exposeDev.js
// Dev helpers routed EXCLUSIVELY via /api/lbqcc (Edge proxy). No direct GAS calls.

import { calculateEV, estimateConfidence, generateLabel, generateNote } from './aiEngine';
import {
  runFixtureSafe,
  runFixtureRisky,
  runFixtureAvoid,
  runFixtureBorder,
  runAllFixtures,
  listFixtures,
  runFixtureByKey,
} from './fixtures';
import { runAdaptiveCycle, pushFeedback, getAdaptiveSnapshot } from './adaptiveLoop';

const MODEL_URL = process.env.REACT_APP_MODEL_URL || '/api/lbqcc';

function u(mode) {
  const qs = mode ? `?mode=${encodeURIComponent(mode)}&ts=${Date.now()}` : `?ts=${Date.now()}`;
  return `${MODEL_URL}${qs}`;
}

async function getJson(mode) {
  const r = await fetch(u(mode), { method: 'GET', headers: { 'cache-control': 'no-cache' } });
  const t = await r.text();
  try {
    return { ok: r.ok, status: r.status, json: JSON.parse(t), raw: t };
  } catch {
    return { ok: r.ok, status: r.status, json: null, raw: t };
  }
}

async function postJson(payload) {
  const r = await fetch(MODEL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  const t = await r.text();
  try {
    return { ok: r.ok, status: r.status, json: JSON.parse(t), raw: t };
  } catch {
    return { ok: r.ok, status: r.status, json: null, raw: t };
  }
}

// ── Public dev ops via proxy ───────────────────────────────────────────────────
async function lbqPing() {
  const r = await getJson('ping');
  console.log('[LBQ][dev] ping →', r);
  return r;
}
async function lbqFetchConfig() {
  const r = await getJson('config');
  console.log('[LBQ][dev] config →', r);
  return r;
}
// Optional “recalc” (proxy will just echo a generic GET if not implemented)
async function lbqRecalc() {
  const r = await getJson('recalc');
  console.log('[LBQ][dev] recalc →', r);
  return r;
}

// Log passthrough only via /api/lbqcc POST
async function lbqLog(payload) {
  const r = await postJson(
    payload || { ts: Date.now(), tag: 'dev-log', note: 'manual log from dev console' }
  );
  console.log('[LBQ][dev] log →', r);
  return r;
}

// Inspect what the client currently holds
function lbqInspectClient() {
  const weights = typeof window !== 'undefined' ? window.__LBQ_WEIGHTS__ : null;
  const meta = typeof window !== 'undefined' ? window.__LBQ_WEIGHTS_META__ : null;
  console.log('[LBQ][dev] client weights/meta →', { weights, meta });
  return { weights, meta };
}

// ── Export/attach for easy use from DevTools ───────────────────────────────────
const Dev = {
  // proxy ops
  ping: lbqPing,
  config: lbqFetchConfig,
  recalc: lbqRecalc,
  log: lbqLog,
  inspectClient: lbqInspectClient,

  // AI helpers & fixtures
  calculateEV,
  estimateConfidence,
  generateLabel,
  generateNote,
  runFixtureSafe,
  runFixtureRisky,
  runFixtureAvoid,
  runFixtureBorder,
  runAllFixtures,
  listFixtures,
  runFixtureByKey,
  runAdaptiveCycle,
  pushFeedback,
  getAdaptiveSnapshot,
};

if (typeof window !== 'undefined') {
  window.__LBQ_DEV__ = Dev;

  // Backwards-compat aliases you ήδη χρησιμοποιούσες:
  window.__LBQ_PING = lbqPing;
  window.__LBQ_RECALC = lbqRecalc;
  window.__LBQ_FETCH_CONFIG = lbqFetchConfig;

  window.LBQ_ai = {
    calculateEV,
    estimateConfidence,
    generateLabel,
    generateNote,
    runFixtureSafe,
    runFixtureRisky,
    runFixtureAvoid,
    runFixtureBorder,
    runAllFixtures,
    listFixtures,
    runFixtureByKey,
    runAdaptiveCycle,
    pushFeedback,
    getAdaptiveSnapshot,
  };

  window.LBQ_listFixtures = typeof listFixtures === 'function' ? listFixtures : () => [];
  window.LBQ_testFixture = typeof runFixtureByKey === 'function' ? runFixtureByKey : () => null;
  window.LBQ_adapt = typeof runAdaptiveCycle === 'function' ? runAdaptiveCycle : () => ({ changed: false });
  window.LBQ_feedback = typeof pushFeedback === 'function' ? pushFeedback : () => null;
  window.LBQ_adaptSnapshot = typeof getAdaptiveSnapshot === 'function' ? getAdaptiveSnapshot : () => ({});

  console.log('[LBQ][dev] helpers ready @', MODEL_URL);
}

export {
  lbqPing,
  lbqRecalc,
  lbqFetchConfig,
  lbqLog,
  lbqInspectClient,
};
export default Dev;