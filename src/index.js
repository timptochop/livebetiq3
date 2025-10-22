import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { exposeLiveCounter } from './utils/liveCounter';
import { ensurePermissionIfEnabled } from './push/notifyControl';
import './ai/resultHook';
import './hooks/resultAutoReporter';

exposeLiveCounter();
ensurePermissionIfEnabled();

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);