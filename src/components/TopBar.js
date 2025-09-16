// src/components/TopBar.js
import React from "react";

export default function TopBar({
  liveCount = 0,
  notificationsOn = false,
  onToggleNotifications = () => {},
}) {
  const BAR_H = 64;
  const safeTop = "env(safe-area-inset-top, 0px)";

  return (
    <header
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 9999,
        height: `calc(${safeTop} + ${BAR_H}px)`,
        paddingTop: safeTop,
        background: "rgba(12,15,16,0.98)",
        borderBottom: "1px solid #1a1d20",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "8px 12px",
          display: "grid",
          gridTemplateColumns: "auto 1fr auto auto",
          gap: 10,
          alignItems: "center",
          height: BAR_H,
        }}
      >
        {/* Logo (χωρίς καμία μικρή τελίτσα) */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: "#0e2a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 0 0 1px #12331f",
          }}
        >
          <img
            src="/logo192.png"
            alt="LiveBetIQ"
            style={{ width: 42, height: 42, display: "block" }}
          />
        </div>

        {/* LIVE badge με counter */}
        <div
          style={{
            justifySelf: "start",
            height: 44,
            padding: "0 12px",
            borderRadius: 22,
            background: "#101415",
            boxShadow: "inset 0 0 0 1px #1f2427",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "#1ad15a",
            }}
          />
          <span style={{ fontWeight: 700, letterSpacing: 0.3 }}>LIVE</span>
          <span
            style={{
              background: "#0dbb4d",
              color: "#05140b",
              fontWeight: 800,
              minWidth: 36,
              textAlign: "center",
              padding: "6px 10px",
              borderRadius: 16,
            }}
          >
            {liveCount}
          </span>
        </div>

        {/* Notifications toggle */}
        <button
          onClick={() => onToggleNotifications(!notificationsOn)}
          aria-label={`Notifications ${notificationsOn ? "on" : "off"}`}
          style={{
            height: 44,
            padding: "0 12px",
            borderRadius: 22,
            background: "#101415",
            boxShadow: "inset 0 0 0 1px #1f2427",
            color: "#cbd5d9",
            display: "flex",
            alignItems: "center",
            gap: 10,
            border: "none",
            cursor: "pointer",
          }}
        >
          <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>🔔</span>
          <span
            style={{
              fontWeight: 800,
              background: notificationsOn ? "#16c05f" : "#30363a",
              color: notificationsOn ? "#052213" : "#cbd5d9",
              padding: "6px 12px",
              borderRadius: 16,
            }}
          >
            {notificationsOn ? "ON" : "OFF"}
          </span>
        </button>

        {/* Login placeholder */}
        <button
          aria-label="Login"
          style={{
            height: 44,
            width: 68,
            borderRadius: 22,
            background: "#101415",
            boxShadow: "inset 0 0 0 1px #1f2427",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 999,
              background: "linear-gradient(#89a7c7, #38506b)",
              boxShadow: "inset 0 -2px 4px #284057, 0 0 0 2px #1a2230",
              display: "inline-block",
            }}
          />
        </button>
      </div>
    </header>
  );
}