// src/components/TopSpacer.js
import React from "react";

export default function TopSpacer() {
  return (
    <div style={{
      height: 40,
      background: "#0a0c0e",
      width: "100%",
      position: "fixed",
      top: 0,
      left: 0,
      zIndex: 999
    }} />
  );
}