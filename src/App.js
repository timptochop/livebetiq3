import React, { useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './components/LiveTennis';
import ToastCenter from './components/ToastCenter';

export default function App() {
  // live counter shown in TopBar
  const [liveCount, setLiveCount] = useState(0);

  // persist toggles
  const [notificationsOn, setNotificationsOn] = useState(() => {
    return localStorage.getItem('lbq_notifications') === '1';
  });
  const [audioOn, setAudioOn] = useState(() => {
    return localStorage.getItem('lbq_audio') !== '0'; // default ON
  });

  useEffect(() => {
    localStorage.setItem('lbq_notifications', notificationsOn ? '1' : '0');
  }, [notificationsOn]);
  useEffect(() => {
    localStorage.setItem('lbq_audio', audioOn ? '1' : '0');
  }, [audioOn]);

  // notify mode (ONCE | ON_CHANGE)
  const [notifyMode, setNotifyMode] = useState(() => {
    return localStorage.getItem('lbq_notify_mode') || 'ONCE';
  });
  useEffect(() => {
    localStorage.setItem('lbq_notify_mode', notifyMode);
  }, [notifyMode]);

  const cycleNotifyMode = () =>
    setNotifyMode((m) => (m === 'ONCE' ? 'ON_CHANGE' : 'ONCE'));

  return (
    <>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        onToggleNotifications={() => setNotificationsOn((v) => !v)}
        audioOn={audioOn}
        onToggleAudio={() => setAudioOn((v) => !v)}
        notifyMode={notifyMode}
        onCycleNotifyMode={cycleNotifyMode}
      />

      {/* Main content */}
      <div style={{ padding: 12 }}>
        <LiveTennis
          onLiveCount={setLiveCount}
          notifyMode={notifyMode}
          notificationsOn={notificationsOn}
          audioOn={audioOn}
        />
      </div>

      {/* Toast renderer */}
      <ToastCenter />
    </>
  );
}