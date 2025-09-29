// src/utils/liveCount.js
// Tiny bus to share the current LIVE matches count app-wide.

const EVT = "live-count";

export function emitLiveCount(n) {
  const count = Number.isFinite(n) ? n : 0;
  window.__LIVE_COUNT__ = count;
  window.dispatchEvent(new CustomEvent(EVT, { detail: count }));
}

export function subscribeLiveCount(setter) {
  const handler = (e) => setter(typeof e.detail === "number" ? e.detail : 0);
  window.addEventListener(EVT, handler);
  return () => window.removeEventListener(EVT, handler);
}

export function getInitialLiveCount() {
  return typeof window.__LIVE_COUNT__ === "number" ? window.__LIVE_COUNT__ : 0;
}