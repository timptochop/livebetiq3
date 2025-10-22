// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Helpers (δεν αλλάζουν UI)
import { exposeLiveCounter } from './utils/liveCounter';
import { ensurePermissionIfEnabled } from './push/notifyControl';

// ⬇️ Προσθήκη: side-effect import για να εκτελεστεί το hook
// και να εκτεθεί στο window η LBQ_reportFinishedMatch
import './ai/resultHook';

exposeLiveCounter();
ensurePermissionIfEnabled();

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);