// src/utils/predictionLogger.js
const ENABLED = String(process.env.REACT_APP_LOG_PREDICTIONS || '0') === '1';
const MODEL = process.env.REACT_APP_AI_ENGINE || 'v2';

// μικρό session id για να ομαδοποιούμε logs στο ίδιο browser
function getSid() {
  try {
    const k = 'lbq.sid';
    let v = localStorage.getItem(k);
    if (!v) {
      v = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(k, v);
    }
    return v;
  } catch {
    return 'nosid';
  }
}

// αποφυγή διπλο-logs (π.χ. re-renders) για 10"
const recent = new Map();
function dedupe(key, ttlMs = 10_000) {
  const now = Date.now();
  const hit = recent.get(key);
  if (hit && now - hit < ttlMs) return true;
  recent.set(key, now);
  // καθάρισμα παλιών
  for (const [k, t] of recent) if (now - t > ttlMs) recent.delete(k);
  return false;
}

// ασφαλές κόψιμο μεγάλων αντικειμένων για να μην φουσκώνουν τα logs
function slimData(data = {}) {
  const clone = { ...data };
  if (clone.features && typeof clone.features === 'object') {
    const {
      pOdds,
      momentum,
      drift,
      setNum,
      live,
      // κράτα ό,τι χρειάζεται για debugging – πέτα πολύ-βαριά πεδία
      ...rest
    } = clone.features;
    clone.features = { pOdds, momentum, drift, setNum, live };
    // κράτα και ό,τι άλλο θεωρείς ελαφρύ στο μέλλον από το rest
  }
  // στρογγύλεμα confidence
  if (typeof clone.conf === 'number') {
    clone.conf = Math.round(clone.conf * 1000) / 1000;
  }
  return clone;
}

function send(payload) {
  // 1) Console (πάντα αν ENABLED)
  try {
    // eslint-disable-next-line no-console
    console.debug('[pred-log]', payload);
  } catch {}

  // 2) Server (αν υπάρχει endpoint). Δεν ρίχνουμε σφάλματα προς τα έξω.
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      // αν δεν έχεις δικό σου endpoint, αυτό απλά θα 404 και δεν μας νοιάζει
      navigator.sendBeacon('/api/predictions', blob);
      return;
    }
    if (typeof fetch === 'function') {
      // keepalive: true για να φύγει ακόμη κι αν αλλάξει σελίδα
      fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}
}

/**
 * Default logger – συμβατό με παλιές κλήσεις.
 * Παράδειγμα: log('prediction', { matchId, label, conf, tip, features })
 */
export default function log(event, data = {}) {
  if (!ENABLED) return;

  const base = {
    ts: new Date().toISOString(),
    sid: getSid(),
    app: 'livebetiq3',
    model: MODEL,
    event,
    data: slimData(data),
  };

  // dedupe key: event + matchId + label + conf(rough)
  const d = base.data || {};
  const key = [
    event || '',
    d.matchId || d.id || '',
    d.label || '',
    Math.round((d.conf || 0) * 100),
  ].join('|');

  if (dedupe(key)) return;
  send(base);
}

/**
 * Εξειδικευμένη συντόμευση για predictions.
 * payload: { matchId, label, conf, tip, features, kellyLevel }
 */
export function logPrediction(payload = {}) {
  return log('prediction', payload);
}

/**
 * Λογικά σφάλματα χωρίς να σπάει το UI.
 * meta optional: { matchId, where, details }
 */
export function logError(error, meta = {}) {
  if (!ENABLED) return;
  const safeErr = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
  return log('error', { ...meta, error: safeErr });
}