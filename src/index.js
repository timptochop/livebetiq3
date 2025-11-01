// src/index.js
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

// ---- Bootstrap: URL/SECRET από query ή localStorage (χωρίς index.html) ----
(function bootstrapLBQGlobals() {
  try {
    const qp = new URLSearchParams(window.location.search);
    const qpUrl    = qp.get('modelUrl');
    const qpSecret = qp.get('secret');

    const lsUrl    = localStorage.getItem('LBQ_WEBAPP_URL');
    const lsSecret = localStorage.getItem('LBQ_SECRET');

    // τελικές τιμές: query > localStorage > κενό (θα χειριστεί το modelClient)
    const finalUrl    = qpUrl    || lsUrl    || '';
    const finalSecret = qpSecret || lsSecret || '';

    if (qpUrl)    localStorage.setItem('LBQ_WEBAPP_URL', qpUrl);
    if (qpSecret) localStorage.setItem('LBQ_SECRET', qpSecret);

    // κάν’ τα διαθέσιμα στο modelClient
    window.__LBQ_WEBAPP_URL = String(finalUrl);
    window.__LBQ_SECRET     = String(finalSecret);

    console.info('[LBQ] Globals set',
      { url: !!finalUrl ? 'OK' : '(missing)', secret: finalSecret ? 'set' : '(empty)' });
  } catch (err) {
    console.warn('[LBQ] bootstrap globals failed:', err);
  }
})();

// ---- Pull adaptive weights from GAS (fire-and-forget) ----
loadLbqConfigOnce().then((res) => {
  if (res && res.ok && res.updated) {
    console.log('[LBQ] adaptive weights loaded from GAS:', res.weights, res.meta);
  } else if (res && res.skipped) {
    console.log('[LBQ] adaptive weights skipped (older-or-same)');
  }
}).catch(() => {
  // fail silent
});

// ---- App boot ----
exposeLiveCounter();
ensurePermissionIfEnabled();

if (typeof window !== 'undefined') {
  window.LBQ_reportIfFinished = reportIfFinished;
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

// ---- Model pull on startup + δυνατά logs (success/fail) ----
async function bootModel() {
  try {
    const res = await loadModelAndApply();
    if (res && res.ok && res.cutoffs) {
      console.log('[LBQ] Model cutoffs loaded:', res.cutoffs);
    } else {
      console.warn('[LBQ] Model load failed:', res);
    }
  } catch (err) {
    console.error('[LBQ] Model load exception:', err);
  }
}
bootModel().catch(() => {});

// ---- Dev helpers για έλεγχο μέσα από το console ----
if (typeof window !== 'undefined') {
  window.__LBQ_DEBUG_MODEL = async () => {
    const r = await loadModelAndApply();
    console.log('[LBQ] DEBUG reload model →', r);
    return r;
  };
  // γρήγορο help
  console.log('[LBQ] Tip: προσθέτεις ?modelUrl=<WEBAPP_URL>&secret=<SECRET> μία φορά → αποθηκεύεται στο localStorage.');
}