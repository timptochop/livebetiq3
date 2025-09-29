import React, { useEffect, useMemo, useRef, useState } from "react";
import "./TopBar.css";

function IconBtn({ onMouseDown, onMouseUp, onTouchStart, onTouchEnd, title, children, active }) {
  return (
    <button
      type="button"
      className={`tb-icon ${active ? "is-active" : ""}`}
      aria-label={title}
      title={title}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </button>
  );
}

export default function TopBar({ liveCount = 0, onToggleAudio, onToggleNotify }) {
  const [notifyOn, setNotifyOn] = useState(() => localStorage.getItem("notifyOn") !== "0");
  const [audioOn, setAudioOn] = useState(() => localStorage.getItem("audioOn") !== "0");

  useEffect(() => {
    localStorage.setItem("notifyOn", notifyOn ? "1" : "0");
    if (typeof onToggleNotify === "function") onToggleNotify(notifyOn);
  }, [notifyOn, onToggleNotify]);

  useEffect(() => {
    localStorage.setItem("audioOn", audioOn ? "1" : "0");
    if (typeof onToggleAudio === "function") onToggleAudio(audioOn);
  }, [audioOn, onToggleAudio]);

  // Long-press timer for bell (test notification)
  const holdTimer = useRef(null);
  const startHold = () => {
    clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      void testNotification();
    }, 600);
  };
  const endHold = () => {
    clearTimeout(holdTimer.current);
  };

  const toggleNotify = () => setNotifyOn(v => !v);
  const toggleAudio  = () => setAudioOn(v => !v);

  return (
    <div className="TopBar">
      <div className="tb-left">
        <span className="brand"><b>LIVE</b><span className="brand-green">BET</span> IQ</span>
        <span className="live-pill">
          <span className="dot" />
          <span className="txt">LIVE</span>
          <span className="badge">{liveCount}</span>
        </span>
      </div>

      <div className="tb-right">
        <IconBtn
          title="Notifications"
          active={notifyOn}
          onMouseDown={startHold}
          onMouseUp={(e) => { endHold(); toggleNotify(); }}
          onTouchStart={startHold}
          onTouchEnd={(e) => { endHold(); toggleNotify(); }}
        >
          {/* bell */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3a6 6 0 0 0-6 6v3.38l-.894 2.236A1 1 0 0 0 6.03 16h11.94a1 1 0 0 0 .924-1.384L18 12.38V9a6 6 0 0 0-6-6Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9 18a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </IconBtn>

        <IconBtn title="Sound" active={audioOn} onMouseDown={null} onMouseUp={toggleAudio} onTouchStart={null} onTouchEnd={toggleAudio}>
          {/* speaker */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 10v4h3l5 4V6l-5 4H4Z" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M16 9a3 3 0 0 1 0 6" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M18.5 6.5a7 7 0 0 1 0 11" stroke="currentColor" strokeWidth="1.8"/>
          </svg>
        </IconBtn>
      </div>
    </div>
  );
}

/* ---- helpers ---- */
async function testNotification() {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }
    if (Notification.permission !== "granted") return;

    // Prefer SW notification so it matches push behavior
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = {
      body: "Test notification (LiveBet IQ)",
      icon: "/logo192.png",
      badge: "/logo192.png",
      tag: "lbiq-test",
      renotify: true,
      silent: false,
    };
    if (reg && reg.showNotification) {
      await reg.showNotification("LiveBet IQ", opts);
    } else {
      // fallback
      new Notification("LiveBet IQ", opts);
    }
  } catch {
    // no-op
  }
}