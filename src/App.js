// src/App.js
import React, { useState, useCallback } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './components/LiveTennis';
import './App.css';

export default function App() {
  const [liveCount, setLiveCount] = useState(0);
  const [notificationsOn, setNotificationsOn] = useState(false);

  const handleLiveCount = useCallback((n) => {
    if (Number.isFinite(n)) setLiveCount(n);
  }, []);

  return (
    <>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        onToggleNotifications={setNotificationsOn}
      />
      {/* VERY IMPORTANT: this padding keeps the list below the (tall) sticky bar */}
      <main className="page">
        <LiveTennis onLiveCount={handleLiveCount} />
      </main>
    </>
  );
}