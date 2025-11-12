// src/utils/aiBoot.js
// Boot-time attachment of runtime markers for quick verification in Console.
// Exposes __AI_VERSION__ and __AI_VOL__ πάνω στο window και στο globalThis (όπου υπάρχει).

(function attachAiMarkers() {
  try {
    if (typeof window === "undefined") return;

    // Ορισμός/getters ώστε να είναι πάντα συγχρονισμένα με τα runtime writes του adapter.
    if (!Object.getOwnPropertyDescriptor(window, "__AI_VERSION__")) {
      Object.defineProperty(window, "__AI_VERSION__", {
        get() {
          // default μέχρι να το ενημερώσει ο adapter
          return window.__AI_VERSION_CACHE__ ?? "v2.1";
        },
        set(v) {
          window.__AI_VERSION_CACHE__ = v;
        },
        configurable: true,
        enumerable: false,
      });
    }

    if (!Object.getOwnPropertyDescriptor(window, "__AI_VOL__")) {
      Object.defineProperty(window, "__AI_VOL__", {
        get() {
          // default μέχρι να το ενημερώσει ο adapter (raw.volatility)
          return window.__AI_VOL_CACHE__ ?? null;
        },
        set(v) {
          window.__AI_VOL_CACHE__ = v;
        },
        configurable: true,
        enumerable: false,
      });
    }

    // Προσπάθησε να “καθρεφτίσεις” και σε globalThis αν υπάρχει, χωρίς να προκαλείς eslint no-undef.
    try {
      // eslint-disable-next-line no-new-func
      const g = Function("return (typeof globalThis!=='undefined'?globalThis:undefined)")();
      if (g) {
        Object.defineProperty(g, "__AI_VERSION__", {
          get: () => window.__AI_VERSION__,
          set: (v) => { window.__AI_VERSION__ = v; },
          configurable: true,
          enumerable: false,
        });
        Object.defineProperty(g, "__AI_VOL__", {
          get: () => window.__AI_VOL__,
          set: (v) => { window.__AI_VOL__ = v; },
          configurable: true,
          enumerable: false,
        });
      }
    } catch {
      // προαιρετικό, δεν είναι κρίσιμο για λειτουργία
    }

    console.log("[AI Boot] Markers attached (__AI_VERSION__, __AI_VOL__)");
  } catch (err) {
    console.warn("[AI Boot] attach failed:", err);
  }
})();