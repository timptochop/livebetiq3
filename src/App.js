// src/App.js
import React, { useCallback, useEffect, useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './components/LiveTennis';
// Προτιμώ να εισάγω ΟΛΑ τα exports, για να μην «κολλήσουμε» σε default/named
import * as push from './push/pushClient';

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

  // Ενεργοποίηση/απενεργοποίηση push με «ευέλικτες» κλήσεις στα helpers,
  // ώστε να μη σπάμε αν το module έχει διαφορετικά ονόματα exports.
  const ensurePushEnabled = useCallback(async (nextOn) => {
    if (typeof window === 'undefined') return false;
    try {
      if (nextOn) {
        // Προσπάθησε να βεβαιωθείς ότι υπάρχει SW & subscribe
        await (push.init?.() ?? Promise.resolve());
        await (push.ensureSW?.() ?? Promise.resolve());
        if (push.registerPush) {
          await push.registerPush();
        } else if (push.subscribe) {
          await push.subscribe();
        } else if (push.subscribeClient) {
          await push.subscribeClient();
        }
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