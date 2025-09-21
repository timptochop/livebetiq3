// src/App.js
import React, { useCallback, useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './components/LiveTennis';

// Φορτώνει το push module μόνο όταν χρειάζεται (runtime)
async function loadPush() {
  try {
    const mod = await import('./push/pushClient');
    return mod || {};
  } catch (e) {
    console.warn('[push] module not found/failed to load:', e);
    return {};
  }
}

export default function App() {
  const [liveCount, setLiveCount] = useState(0);

  const [audioOn, setAudioOn] = useState(() => {
    try { return localStorage.getItem('lb.audioOn') === '1'; } catch { return false; }
  });
  const [notificationsOn, setNotificationsOn] = useState(() => {
    try { return localStorage.getItem('lb.notificationsOn') === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem('lb.audioOn', audioOn ? '1' : '0'); } catch {}
  }, [audioOn]);

  useEffect(() => {
    try { localStorage.setItem('lb.notificationsOn', notificationsOn ? '1' : '0'); } catch {}
  }, [notificationsOn]);

  const onToggleAudio = useCallback(() => setAudioOn(v => !v), []);

  const ensurePushEnabled = useCallback(async (nextOn) => {
    if (typeof window === 'undefined') return false;

    try {
      const push = await loadPush();

      if (nextOn) {
        // Προσπάθησε «ευγενικά» ό,τι υπάρχει
        await (push.init?.() ?? Promise.resolve());
        await (push.ensureSW?.() ?? Promise.resolve());

        if (push.registerPush)       await push.registerPush();
        else if (push.subscribe)     await push.subscribe();
        else if (push.subscribeClient) await push.subscribeClient();

        const perm = window.Notification?.permission;
        return perm === 'granted';
      } else {
        await (push.unsubscribe?.() ||
               push.unsubscribeClient?.() ||
               push.unregisterPush?.() ||
               Promise.resolve());
        return false;
      }
    } catch (err) {
      console.warn('[push] toggle failed:', err);
      return false;
    }
  }, []);

  const onToggleNotifications = useCallback(async () => {
    const next = !notificationsOn;
    const ok = await ensurePushEnabled(next);
    setNotificationsOn(next && ok);
  }, [notificationsOn, ensurePushEnabled]);

  return (
    <div style={{ background: '#0b0e12', minHeight: '100vh', color: '#c7d1dc' }}>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        onToggleNotifications={onToggleNotifications}
        audioOn={audioOn}
        onToggleAudio={onToggleAudio}
      />
      <div style={{ padding: '12px 10px 40px' }}>
        <LiveTennis onLiveCount={setLiveCount} notificationsOn={notificationsOn} />
      </div>
    </div>
  );
}