// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

import { exposeLiveCounter } from './utils/liveCounter';
import { ensurePermissionIfEnabled } from './push/notifyControl';
import { reportIfFinished } from './ai/feedHook';
import './ai/exposeDev';

// NEW: pull tuner cutoffs from Apps Script WebApp on startup
import { loadModelAndApply } from './ai/modelClient';

exposeLiveCounter();
ensurePermissionIfEnabled();

if (typeof window !== 'undefined') {
  window.LBQ_reportIfFinished = reportIfFinished;
}

// Fire-and-forget: load cutoffs (thrSafe/thrRisky[/minEV]) at app start
(async () => {
  try {
    const res = await loadModelAndApply();
    if (res?.ok) {
      const c = res.cutoffs || {};
      console.log('[LBQ] Model cutoffs loaded:', c);
      // keep the last loaded cutoffs handy for quick devtools inspection
      if (typeof window !== 'undefined') window.__LBQ_LAST_CUTOFFS__ = c;
    } else {
      console.warn('[LBQ] Model cutoffs NOT loaded:', res);
    }
  } catch (err) {
    console.error('[LBQ] Model fetch failed:', err);
  }
})();

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);