// src/utils/analyzeMatch.js
// Λεπτό wrapper πάνω από τον predictor με logging guard.

import { predictMatch, isUpcoming, isFinishedLike } from './predictor';
import { logPrediction } from './predictionLogger';

const LOG = String(process.env.REACT_APP_LOG_PREDICTIONS || '').trim() === '1';

export default function analyzeMatch(m = {}) {
  const status = m.status || m['@status'] || '';

  // Guard για τεχνική συνέπεια με το UI
  if (isFinishedLike(status)) {
    const out = { label: 'AVOID', conf: 0.99, tip: null, features: { status } };
    if (LOG) safeLog(m, out);
    return out;
  }
  if (isUpcoming(status)) {
    const out = { label: 'SOON', conf: 0.50, tip: null, features: { status } };
    if (LOG) safeLog(m, out);
    return out;
  }

  const out = predictMatch(m);
  if (LOG) safeLog(m, out);
  return out;
}

// --- internal ---
function safeLog(match, out) {
  try {
    if (typeof logPrediction === 'function') {
      logPrediction(match, out);
      return;
    }
  } catch (_) {}
  // fallback σε console, αν για κάποιο λόγο λείπει το utility
  try {
    // πολύ συνοπτικό για να μη γεμίζουμε το console
    console.log('[AI]', (match?.players?.[0]?.name || match?.player?.[0]?.['@name'] || '?'),
      'vs',
      (match?.players?.[1]?.name || match?.player?.[1]?.['@name'] || '?'),
      '->', out.label, `(${(out.conf*100|0)}%)`, out.tip || '');
  } catch (_) {}
}