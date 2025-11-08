// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// App services & dev helpers
import { exposeLiveCounter } from './utils/liveCounter';
import { ensurePermissionIfEnabled } from './push/notifyControl';
import { reportIfFinished } from './ai/feedHook';
import './ai/exposeDev';

// Unified config loaders (Edge proxy /api/lbqcc)
import { loadModelAndApply } from './ai/modelClient';      // loads thrSafe/thrRisky/minEV
import { loadLbqConfigOnce } from './utils/loadLbqConfig'; // loads adaptive weights

// Optional bootstrap for legacy query/localStorage knobs (safe no-ops if unused)
(function bootstrapLBQGlobals() {
  try {
    const qp = new URLSearchParams(window.location.search);
    const qpUrl = qp.get('modelUrl');
    const qpSecret = qp.get('secret');

    const lsUrl = localStorage.getItem('LBQ_WEBAPP_URL');
    const lsSecret = localStorage.getItem('LBQ_SECRET');

    const finalUrl = qpUrl || lsUrl || '';
    const finalSecret = qpSecret || lsSecret || '';

    if (qpUrl) localStorage.setItem('LBQ_WEBAPP_URL', qpUrl);
    if (qpSecret) localStorage.setItem('LBQ_SECRET', qpSecret);

    window.__LBQ_WEBAPP_URL = String(finalUrl);
    window.__LBQ_SECRET = String(finalSecret);

    console.info('[LBQ] Globals set', {
      url: finalUrl ? 'OK' : '(missing)',
      secret: finalSecret ? 'set' : '(empty)',
    });
  } catch (err) {
    console.warn('[LBQ] bootstrap globals failed:', err);
  }
})();

// ---- Boot sequence: cutoffs → weights → render (all via /api/lbqcc) ----
async function boot() {
  // 1) Load model cutoffs (thrSafe / thrRisky / minEV) from unified endpoint
  const cut = await loadModelAndApply();
  if (cut?.ok && cut?.cutoffs) {
    console.log('[LBQ] Model cutoffs loaded:', cut.cutoffs, `(source: ${cut.source})`);
  } else {
    console.warn('[LBQ] Model load failed:', cut?.reason || cut || '(unknown)');
  }

  // 2) Load adaptive weights (ev/confidence/momentum/drift/surface/form) from unified endpoint
  const weights = await loadLbqConfigOnce();
  if (weights?.ok && weights?.updated) {
    console.log('[LBQ] adaptive weights loaded:', weights.weights, `(source: ${weights.source})`);
  } else if (weights?.ok && weights?.skipped) {
    console.log('[LBQ] adaptive weights skipped (older-or-same)');
  } else {
    console.warn('[LBQ] adaptive weights load failed:', weights?.reason || '(unknown)');
  }

  // 3) App services
  exposeLiveCounter();
  ensurePermissionIfEnabled();

  if (typeof window !== 'undefined') {
    window.LBQ_reportIfFinished = reportIfFinished;
  }

  // 4) Render
  const container = document.getElementById('root');
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Start
boot().catch((err) => console.error('[LBQ] Boot error:', err));

// Dev helper to force-reload model from console if needed
if (typeof window !== 'undefined') {
  window.__LBQ_DEBUG_MODEL = async () => {
    const r = await loadModelAndApply();
    console.log('[LBQ] DEBUG reload model →', r);
    return r;
  };
  console.log(
    '[LBQ] Tip: optional query knobs ?modelUrl=<URL>&secret=<SECRET> are persisted in localStorage.'
  );
}