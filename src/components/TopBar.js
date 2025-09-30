import React from "react";
import "./TopBar.css";

export default function TopBar({
  liveCount = 0,
  notificationsOn,
  setNotificationsOn,
  audioOn,
  setAudioOn,
}) {
  return (
    <header className="topbar" role="banner">
      <div className="tb-inner">
        <div className="brand" aria-label="LiveBet IQ">
          <span className="b1">LIVE</span>
          <span className="b2">BET</span>
          <span className="b3"> IQ</span>
        </div>

        <div className="live-pill" aria-live="polite" aria-label={`Live ${liveCount}`}>
          <span className="dot" aria-hidden="true" />
          <span className="txt">LIVE</span>
          <span className="cnt">{liveCount}</span>
        </div>

        <div className="actions">
          <button
            className={`icon-btn ${notificationsOn ? "on" : ""}`}
            title={notificationsOn ? "Notifications ON" : "Notifications OFF"}
            aria-pressed={notificationsOn}
            onClick={() => setNotificationsOn(!notificationsOn)}
          >
            {/* bell */}
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path fill="currentColor"
                d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11a6 6 0 1 0-12 0v5L4 18v2h16v-2l-2-2Z"/>
            </svg>
          </button>

          <button
            className={`icon-btn ${audioOn ? "on" : ""}`}
            title={audioOn ? "Sound ON" : "Sound OFF"}
            aria-pressed={audioOn}
            onClick={() => setAudioOn(!audioOn)}
          >
            {/* speaker */}
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path fill="currentColor"
                d="M3 10v4h4l5 4V6L7 10H3Zm13.5 2a3.5 3.5 0 0 0-2.5-3.35v6.7A3.5 3.5 0 0 0 16.5 12Zm0-6.5v2.05A5.5 5.5 0 0 1 20 12a5.5 5.5 0 0 1-3.5 5.45V19.5A7.5 7.5 0 0 0 22 12a7.5 7.5 0 0 0-5.5-6.5Z"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}