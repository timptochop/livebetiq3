// src/utils/liveCounter.js
// Καθαρό helper για το LIVE counter, χωρίς καμία UI αλλαγή.

const EVT = 'live-count';

export function setLiveCount(n) {
  const v = Number(n) || 0;
  try { window.__LIVE_COUNT__ = v; } catch {}
  // Ενημέρωση TopBar (και όποιου άλλου ακούει)
  window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
}

export function getLiveCount() {
  const v = Number(window.__LIVE_COUNT__ || 0);
  return Number.isFinite(v) ? v : 0;
}

// Optional: subscribe αν θες να ακούς αλλαγές από αλλού
export function subscribeLiveCount(cb) {
  const handler = (e) => cb(Number(e.detail || 0));
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}

// Εκθέτει στο window για γρήγορο χειροκίνητο τεστ από Console
export function exposeLiveCounter() {
  window.setLiveCount = setLiveCount;
  window.getLiveCount = getLiveCount;
}