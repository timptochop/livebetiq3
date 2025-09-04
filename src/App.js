// App.js v0.9-patched
import React, { useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './components/LiveTennis';
import './App.css';

export default function App() {
  const [liveCount, setLiveCount] = useState(0);
  const [notificationsOn, setNotificationsOn] = useState(true); // toggle για Notification Center (UI μόνο προς το παρόν)

  return (
    <div className="app-shell">
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        onToggleNotifications={() => setNotificationsOn(v => !v)}
      />

      {/* ✅ FIXED SPACER για να σπρώχνει κάτω την πρώτη κάρτα */}
      <div style={{ height: 104 }} />

      <main className="page-content">
        <LiveTennis onLiveCount={setLiveCount} />
      </main>
    </div>
  );
}