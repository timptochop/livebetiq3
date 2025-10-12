// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Λογική (καθαρά helpers, καμία UI αλλαγή)
import { exposeLiveCounter } from './utils/liveCounter';
import { ensurePermissionIfEnabled } from './push/notifyControl';

// Εκθέτουμε τα helpers στο window για τεστ
exposeLiveCounter();

// Αν ο χρήστης είχε ανοίξει τις ειδοποιήσεις, ζήτα άδεια «ήσυχα».
ensurePermissionIfEnabled();

const root = teRoot(document.getElementById('root'));
root.render(<App />);