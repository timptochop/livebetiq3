// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

import { exposeLiveCounter } from './utils/liveCounter';
import { ensurePermissionIfEnabled } from './push/notifyControl';

import { reportIfFinished } from './ai/feedHook';

exposeLiveCounter();
ensurePermissionIfEnabled();

if (typeof window !== 'undefined') {
  window.LBQ_reportIfFinished = reportIfFinished;
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);