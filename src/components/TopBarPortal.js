import { createPortal } from "react-dom";
import React, { useEffect, useState } from "react";

export default function TopBarPortal({ children }) {
  const [node, setNode] = useState(null);

  useEffect(() => {
    const el = document.createElement("div");
    el.id = "tb-root";
    document.body.prepend(el);
    setNode(el);
    return () => el.remove();
  }, []);

  if (!node) return null;
  return createPortal(children, node);
}