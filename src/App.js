// src/App.js
import React, { useCallback, useEffect, useState } from "react";
import TopBar from "./components/TopBar";
import TopSpacer from "./components/TopSpacer";
import LiveTennis from "./components/LiveTennis";
import { loadLbqConfigOnce } from "./utils/loadLbqConfig"; // ← ΜΟΝΟ αυτή η προσθήκη

export default function App() {
  const [liveCount, setLiveCount] = useState(window.__LIVE_COUNT__ || 0);

  useEffect(() => {
    // 1) σύνδεση με το custom event για live count
    const handler = (e) => setLiveCount(Number(e.detail || 0));
    window.addEventListener("live-count", handler);

    // 2) φέρε adaptive weights από το Google Apps Script (ασφαλές, χωρίς UI αλλαγές)
    loadLbqConfigOnce();

    return () => {
      window.removeEventListener("live-count", handler);
    };
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