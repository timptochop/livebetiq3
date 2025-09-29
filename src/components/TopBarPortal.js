import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function TopBarPortal({ children }) {
  const elRef = useRef(null);

  if (!elRef.current && typeof document !== "undefined") {
    const el = document.createElement("div");
    el.className = "TopBarPortal";
    el.style.position = "fixed";
    el.style.top = "0";
    el.style.left = "0";
    el.style.right = "0";
    el.style.zIndex = "9999";
    elRef.current = el;
  }

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    document.body.appendChild(el);
    return () => {
      try { document.body.removeChild(el); } catch {}
    };
  }, []);

  return elRef.current ? createPortal(children, elRef.current) : null;
}