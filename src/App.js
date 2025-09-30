import React, { useCallback, useState, useEffect } from "react";
import TopBar from "./components/TopBar";
import TopSpacer from "./components/TopSpacer";
import LiveTennis from "./components/LiveTennis";

export default function App() {
  const [liveCount, setLiveCount] = useState(window.__LIVE_COUNT__ || 0);

  // Συγχρονισμός και από global bus (ασφάλεια)
  useEffect(() => {
    const handler = (e) => setLiveCount(Number(e.detail || 0));
    window.addEventListener("live-count", handler);
    return () => window.removeEventListener("live-count", handler);
  }, []);

  const handleBell = useCallback(() => {
    // εδώ ανοίγεις modal ρυθμίσεων ειδοποιήσεων, αν χρειάζεται
    // ή απλά κάνεις toggle/μήνυμα
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