// src/utils/aiBoot.js
// Boot-time attachment of runtime markers for quick verification in Console.
// Exposes globalThis.__AI_VERSION__ and globalThis.__AI_VOL__,
// forwarding to window.* so they stay live-updated by the adapter.

(function attachAiMarkers() {
  try {
    if (typeof window === "undefined") return;

    const g = (typeof globalThis !== "undefined" ? globalThis : window);

    // __AI_VERSION__: default to 'v2.1' until adapter updates it.
    if (!Object.getOwnPropertyDescriptor(g, "__AI_VERSION__")) {
      Object.defineProperty(g, "__AI_VERSION__", {
        get() {
          return window.__AI_VERSION__ ?? "v2.1";
        },
        set(v) {
          window.__AI_VERSION__ = v;
        },
        configurable: true,
        enumerable: false,
      });
    }

    // __AI_VOL__: default to null until adapter writes raw.volatility.
    if (!Object.getOwnPropertyDescriptor(g, "__AI_VOL__")) {
      Object.defineProperty(g, "__AI_VOL__", {
        get() {
          return window.__AI_VOL__ ?? null;
        },
        set(v) {
          window.__AI_VOL__ = v;
        },
        configurable: true,
        enumerable: false,
      });
    }

    // Small debug line so we can screenshot-proof it.
    console.log("[AI Boot] Markers attached (__AI_VERSION__, __AI_VOL__)");
  } catch (err) {
    // Non-fatal: the app can still run without the markers.
    console.warn("[AI Boot] attach failed:", err);
  }
})();