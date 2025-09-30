import React from "react";

/** Δίνει πάντα χώρο κάτω από το TopBar */
export default function TopSpacer() {
  return <div style={{ height: "var(--tb-offset, 52px)" }} />;
}