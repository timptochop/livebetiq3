// src/index.js
import "./utils/aiBoot";                    // ← boot-time markers (__AI_VERSION__, __AI_VOL__)
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

import { exposeLiveCounter } from './utils/liveCounter';
import { ensurePermissionIfEnabled } from './push/notifyControl';
import { reportIfFinished } from './ai/feedHook';
import './ai/exposeDev';
import { loadModelAndApply } from './ai/modelClient';
import { loadLbqConfigOnce } from './utils/loadLbqConfig';

/**
 * 0) Hard guard: block any direct fetch to Google Apps Script.
 *    We only allow unified proxy via /api/lbqcc.
 *    This eliminates accidental CORS regressions and guarantees single source of truth.
 */
(function armGasSentinel() {
  try {
    if (window.__GAS_SENTINEL_ARMED__) return;
    const origFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input?.url || '');
      if (url.includes('https://script.google.com/macros/')) {
        console.warn('[CHECK] ALERT: DIRECT GAS CALL DETECTED →', url);
        throw new TypeError('blocked-by-gas-sentinel');
      }
      return origFetch(input, init);
    };
    window.__GAS_SENTINEL_ARMED__ = true;
    console.log('[CHECK] GAS sentinel armed');
  } catch (err) {
    console.warn('[CHECK] GAS sentinel failed to arm:', err);
  }
})();

/**
 * 1) Bootstrap: read modelUrl/secret from query or localStorage.
 *    We do NOT rely on index.html for globals.
 */
(function bootstrapLBQGlobals() {
  try {
    const qp = new URLSearchParams(window.location.search);
    const qpUrl    = qp.get('modelUrl');
    const qpSecret = qp.get('secret');

    const lsUrl    = localStorage.getItem('LBQ_WEBAPP_URL');
    const lsSecret = localStorage.getItem('LBQ_SECRET');

    // precedence: query > localStorage > empty
    const finalUrl    = qpUrl    || lsUrl    || '';
    const finalSecret = qpSecret || lsSecret || '';

    if (qpUrl)    localStorage.setItem('LBQ_WEBAPP_URL', qpUrl);
    if (qpSecret) localStorage.setItem('LBQ_SECRET', qpSecret);

    window.__LBQ_WEBAPP_URL = String(finalUrl);
    window.__LBQ_SECRET     = String(finalSecret);

    console.info('[LBQ] Globals set',
      { url: finalUrl ? 'OK' : '(missing)', secret: finalSecret ? 'set' : '(empty)' });
  } catch (err) {
    console.warn('[LBQ] bootstrap globals failed:', err);
  }
})();

/**
 * 2) Fire-and-forget adaptive weights load via unified endpoint (proxied).
 *    Silent on failure; console logs on success/skip.
 */
loadLbqConfigOnce()
  .then((res) => {
    if (res?.ok && res.updated) {
      console.log('[LBQ] adaptive weights loaded:', res.weights, res.meta);
    } else if (res?.skipped) {
      console.log('[LBQ] adaptive weights skipped (older-or-same)');
    }
  })
  .catch(() => { /* no-op */ });

/**
 * 3) App boot
 */
exposeLiveCounter();
ensurePermissionIfEnabled();

if (typeof window !== 'undefined') {
  window.LBQ_reportIfFinished = reportIfFinished;
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

/**
 * 4) Pull model cutoffs on startup (unified endpoint) + robust logs.
 */
async function bootModel() {
  try {
    const res = await loadModelAndApply();
    if (res?.ok && res.cutoffs) {
      console.log('[LBQ] Model cutoffs loaded:', res.cutoffs, `(source: ${res.source})`);
    } else {
      console.warn('[LBQ] Model load failed:', res);
    }
  } catch (err) {
    console.error('[LBQ] Model load exception:', err);
  }
}
bootModel().catch(() => {});

/**
 * 5) Quick console helpers
 */
if (typeof window !== 'undefined') {
  window.__LBQ_DEBUG_MODEL = async () => {
    const r = await loadModelAndApply();
    console.log('[LBQ] DEBUG reload model →', r);
    return r;
  };

  // One-line summary snapshot for screenshots
  setTimeout(() => {
    try {
      const snapshot = {
        cutoffs: window.__LBQ_CUTOFFS__ || null,
        cutoffsMeta: window.__LBQ_CUTOFFS_META__ || null,
        weights: window.__LBQ_WEIGHTS__ || null,
        weightsMeta: window.__LBQ_WEIGHTS_META__ || null,
      };
      console.log('[SUMMARY]', {
        cutoffs: !!snapshot.cutoffs,
        cutoffsMeta: snapshot.cutoffsMeta,
        weights: !!snapshot.weights,
        weightsMeta: snapshot.weightsMeta
      });
    } catch {}
  }, 200);
}