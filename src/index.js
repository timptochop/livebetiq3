import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

/* Keep --tb-offset in sync with real TopBar height */
(function ensureTopBarOffset(){
  const set = () => {
    const el = document.querySelector("header.topbar");
    if (!el) return;
    const h = Math.ceil(el.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--tb-offset", `${h}px`);
  };
  const mo = new MutationObserver(set);
  mo.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("load", set);
  window.addEventListener("resize", set);
  window.addEventListener("orientationchange", set);
  set();
})();