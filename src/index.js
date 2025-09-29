import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

// ---- Keep layout offset in sync with TopBar height ----
(function ensureOffset() {
  const set = () => {
    const el = document.querySelector("header.topbar");
    if (!el) return;
    const h = Math.ceil(el.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--tb-offset", `${h}px`);
  };
  const mo = new MutationObserver(set);
  mo.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("load", set, { passive: true });
  window.addEventListener("resize", set, { passive: true });
  window.addEventListener("orientationchange", set, { passive: true });
  set();
})();

// ---- Service Worker (for notifications & push) ----
(function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  const register = async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      // Ensure SW is ready for showNotification
      await navigator.serviceWorker.ready;

      // Keep it fresh
      reg.update().catch(() => {});

      // Recompute TopBar offset when SW takes control (optional)
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setTimeout(() => window.dispatchEvent(new Event("resize")), 0);
      });
    } catch (err) {
      console.warn("[SW] register failed:", err?.message || err);
    }
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
})();