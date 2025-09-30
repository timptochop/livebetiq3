import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

// Εγγύηση ότι το --tb-offset θα έχει πάντα σωστή τιμή
(function ensureTopbarOffset() {
  const set = () => {
    const el = document.querySelector("header.topbar");
    if (!el) return;
    const h = Math.ceil(el.getBoundingClientRect().height || 0);
    document.documentElement.style.setProperty("--tb-offset", `${h}px`);
  };
  const mo = new MutationObserver(set);
  mo.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("load", set);
  window.addEventListener("resize", set);
  window.addEventListener("orientationchange", set);
  set();
})();