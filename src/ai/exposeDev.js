// src/ai/exposeDev.js
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

function url(mode) {
  const qs = mode ? `?mode=${encodeURIComponent(mode)}&ts=${Date.now()}` : `?ts=${Date.now()}`;
  return `${MODEL_URL}${qs}`;
}

async function get(mode) {
  const r = await fetch(url(mode), { method: 'GET', headers: { 'cache-control': 'no-cache' } });
  if (!r.ok) throw new Error('http-' + r.status);
  return r.json();
}

async function lbqPing() { return get('ping'); }
async function lbqRecalc() { return get('recalc'); }
async function lbqFetchConfig() { return get('config'); }

if (typeof window !== 'undefined') {
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

  window.__LBQ_PING = lbqPing;
  window.__LBQ_RECALC = lbqRecalc;
  window.__LBQ_FETCH_CONFIG = lbqFetchConfig;

  window.LBQ_listFixtures = typeof listFixtures === 'function' ? listFixtures : () => [];
  window.LBQ_testFixture = typeof runFixtureByKey === 'function' ? runFixtureByKey : () => null;

  window.LBQ_adapt = typeof runAdaptiveCycle === 'function' ? runAdaptiveCycle : () => ({ changed: false });
  window.LBQ_feedback = typeof pushFeedback === 'function' ? pushFeedback : () => null;
  window.LBQ_adaptSnapshot = typeof getAdaptiveSnapshot === 'function' ? getAdaptiveSnapshot : () => ({});
}

export { lbqPing, lbqRecalc, lbqFetchConfig };