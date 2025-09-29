import React, { useEffect, useMemo, useState } from "react";
import "./TopBar.css";

export default function TopBar({ liveCount = 0, onToggleMute }) {
  const [granted, setGranted] = useState(
    typeof Notification !== "undefined" ? Notification.permission === "granted" : false
  );
  const [muted, setMuted] = useState(
    (() => {
      try { return localStorage.getItem("lbq_muted") === "1"; } catch { return false; }
    })()
  );

  useEffect(() => {
    try { document.documentElement.style.setProperty("--tb-safe", "env(safe-area-inset-top)"); } catch {}
  }, []);

  const count = useMemo(() => (Number.isFinite(liveCount) ? liveCount : 0), [liveCount]);

  async function handleBell() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      try { window.unsubscribePush?.(); } catch {}
      setGranted(false);
      return;
    }
    try {
      const res = await Notification.requestPermission();
      if (res === "granted") {
        try { await window.subscribePush?.(); } catch {}
        setGranted(true);
      } else {
        setGranted(false);
      }
    } catch {
      setGranted(false);
    }
  }

  function handleSound() {
    const next = !muted;
    setMuted(next);
    try { localStorage.setItem("lbq_muted", next ? "1" : "0"); } catch {}
    try { onToggleMute?.(next); } catch {}
  }

  return (
    <div className="tb">
      <div className="tb-left">
        <div className="brand"><span className="brand-strong">LIVEBET</span>&nbsp;IQ</div>
        <div className="live-badge" aria-label="live matches">
          <span className="dot" />
          <span className="live-text">LIVE</span>
          <span className="count">{count}</span>
        </div>
      </div>

      <div className="tb-actions">
        <button
          type="button"
          className={"icon-btn" + (granted ? " active" : "")}
          onClick={handleBell}
          aria-label="notifications"
        >
          {/* bell */}
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"
              fill="currentColor"
            />
          </svg>
        </button>

        <button
          type="button"
          className={"icon-btn" + (!muted ? " active" : "")}
          onClick={handleSound}
          aria-label="sound"
        >
          {/* speaker */}
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 4.5v15l-6-4.5H4v-6h4l6-4.5ZM19.5 8.5l-2 2m0 3 2 2m-4-5 2 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 4.5v15l-6-4.5H4v-6h4l6-4.5Z" fill="currentColor"/>
              <path d="M17 9a5 5 0 0 1 0 6M19 7a8 8 0 0 1 0 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}