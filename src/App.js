import React, { useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './components/LiveTennis';
import './App.css';

export default function App() {
  const [liveCount, setLiveCount] = useState(0);

  // Notifications ON/OFF από το καμπανάκι
  const [notificationsOn, setNotificationsOn] = useState(false);

  // Όταν ο χρήστης γυρίζει το καμπανάκι σε ON, ζητάμε άδεια
  useEffect(() => {
    if (!notificationsOn) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'default') {
      // Ζήτα άδεια μία φορά
      Notification.requestPermission().catch(() => {});
    }
  }, [notificationsOn]);

  return (
    <>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        onToggleNotifications={setNotificationsOn}
      />

      {/* spacer για το fixed top bar (ίδιο ύψος με TopBar: 80px) */}
      <div style={{ height: 80 }} />

      <div style={{ padding: '10px 10px 24px 10px' }}>
        <LiveTennis
          onLiveCount={setLiveCount}
          notificationsOn={notificationsOn}
        />
      </div>
    </>
  );
}