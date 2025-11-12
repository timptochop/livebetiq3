// src/utils/aiBoot.js
// Boot-time attachment of runtime markers for quick verification in Console.
// Exposes __AI_VERSION__ and __AI_VOL__ πάνω στο window, χωρίς recursion.

(function attachAiMarkers() {
  try {
    if (typeof window === "undefined") return;

    // Internal caches (write-once defaults, runtime θα τα ενημερώνει ο adapter)
    if (typeof window.__AI_VERSION_CACHE__ === "undefined") {
      window.__AI_VERSION_CACHE__ = "v2.1";
    }
    if (typeof window.__AI_VOL_CACHE__ === "undefined") {
      window.__AI_VOL_CACHE__ = null;
    }

    // Define safe getters/setters ONLY on window (avoid globalThis mirroring)
    const hasVer =
      !!Object.getOwnPropertyDescriptor(window, "__AI_VERSION__");
    if (!hasVer) {
      Object.defineProperty(window, "__AI_VERSION__", {
        get() {
          return window.__AI_VERSION_CACHE__;
        },
        set(v) {
          window.__AI_VERSION_CACHE__ = v;
        },
        configurable: true,
        enumerable: false,
      });
    }

    const hasVol =
      !!Object.getOwnPropertyDescriptor(window, "__AI_VOL__");
    if (!hasVol) {
      Object.defineProperty(window, "__AI_VOL__", {
        get() {
          return window.__AI_VOL_CACHE__;
        },
        set(v) {
          window.__AI_VOL_CACHE__ = v;
        },
        configurable: true,
        enumerable: false,
      });
    }

    console.log("[AI Boot] Markers attached (__AI_VERSION__, __AI_VOL__)");
  } catch (err) {
    console.warn("[AI Boot] attach failed:", err);
  }
})();