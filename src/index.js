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

exposeLiveCounter();
ensurePermissionIfEnabled();

if (typeof window !== 'undefined') {
  window.LBQ_reportIfFinished = reportIfFinished;
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

// Bootstrap μοντέλου (cutoffs) στην εκκίνηση
(async function initModel() {
  try {
    const res = await loadModelAndApply();
    if (res && res.ok && res.cutoffs) {
      if (window.__LBQ_DEBUG) console.log('[LBQ] Model cutoffs loaded:', res.cutoffs);
    } else {
      console.warn('[LBQ] Model: using defaults', res && res.reason ? `(${res.reason})` : '');
    }
  } catch (err) {
    console.warn('[LBQ] Model bootstrap failed:', err);
  }
})();