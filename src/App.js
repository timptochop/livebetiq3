import React, { useCallback, useState } from "react";
import TopBar from "./components/TopBar";
import LiveTennis from "./components/LiveTennis";
import "./App.css";

export default function App() {
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const [liveCount, setLiveCount] = useState(0);

  const handleLiveCount = useCallback((n) => setLiveCount(n), []);

  return (
    <>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        setNotificationsOn={setNotificationsOn}
        audioOn={audioOn}
        setAudioOn={setAudioOn}
      />
      <main className="container" data-scroll-root>
        <LiveTennis
          onLiveCount={handleLiveCount}
          notificationsOn={notificationsOn}
          audioOn={audioOn}
        />
      </main>
    </>
  );
}