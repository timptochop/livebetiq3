// src/App.js
import React, { useCallback, useEffect, useState } from "react";
import TopBar from "./components/TopBar";
import TopSpacer from "./components/TopSpacer";
import LiveTennis from "./components/LiveTennis";

export default function App() {
  const [liveCount, setLiveCount] = useState(window.__LIVE_COUNT__ || 0);

  useEffect(() => {
    const handler = (e) => setLiveCount(Number(e.detail || 0));
    window.addEventListener("live-count", handler);
    return () => window.removeEventListener("live-count", handler);
  }, []);

  const handleBell = useCallback(() => {
    // μελλοντικά ρυθμίσεις notifications
  }, []);

  return (
    <>
      <TopBar liveCount={liveCount} onBell={handleBell} />
      <TopSpacer />
      <main style={{ padding: 12 }}>
        <LiveTennis onLiveCount={setLiveCount} />
      </main>
    </>
  );
}