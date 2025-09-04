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
      <main className="page-content">
        <LiveTennis onLiveCount={setLiveCount} />
      </main>
    </div>
  );
}