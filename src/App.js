import React from "react";
import TopBar from "./components/TopBar";
import "./App.css";

/* If you already render your lists elsewhere, keep them as-is.
   Here we only mount TopBar and pass a liveCount placeholder. */

export default function App() {
  const [liveCount, setLiveCount] = React.useState(0);

  // Optional: listen for a custom event to update the pill from anywhere
  React.useEffect(() => {
    const onCount = (e) => setLiveCount(Number(e.detail?.value ?? 0));
    window.addEventListener("live-count", onCount);
    return () => window.removeEventListener("live-count", onCount);
  }, []);

  return (
    <>
      <TopBar liveCount={liveCount} />
      {/* Your existing app structure below */}
      <main className="container">
        {/* keep your existing components here (lists, cards, etc.) */}
      </main>
    </>
  );
}