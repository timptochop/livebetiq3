import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import TopBar from "./TopBar";
import "./TopBar.portal.css";

export default function TopBarPortal(props) {
  const mount = useMemo(() => {
    const el = document.createElement("div");
    el.className = "topbar-layer";
    return el;
  }, []);

  useEffect(() => {
    document.body.appendChild(mount);
    return () => document.body.removeChild(mount);
  }, [mount]);

  return createPortal(
    <div className="topbar-layer-inner">
      <TopBar {...props} />
    </div>,
    mount
  );
}