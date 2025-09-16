// src/App.js
import React, { useState, useCallback } from "react";
import TopBar from "./components/TopBar";
import LiveTennis from "./components/LiveTennis";
import "./App.css";

export default function App() {
  const [liveCount, setLiveCount] = useState(0);
  const [notificationsOn, setNotificationsOn] = useState(false);

  const handleLiveCount = useCallback((n) => {
    if (Number.isFinite(n)) setLiveCount(n);
  }, []);

  const BAR_H = 64;
  const safeTop = "env(safe-area-inset-top, 0px)";

  return (
    <>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        onToggleNotifications={setNotificationsOn}
      />
      <main
        id="app-main"
        style={{
          minHeight: "100vh",
          background: "#0b0b0b",
          paddingTop: `calc(${safeTop} + ${BAR_H}px)`,
        }}
      >
        <LiveTennis onLiveCount={handleLiveCount} />
      </main>
    </>
  );
}