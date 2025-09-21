// src/App.js
import React, { useEffect, useState, useCallback } from 'react';
import LiveTennis from './components/LiveTennis';
import TopBar from './components/TopBar';

// phase-7 helpers (ήδη υπάρχουν στο repo)
import registerPush from './push/registerPush'; // safely no-op αν δεν υποστηρίζεται
// Αν χρησιμοποιείς κάποιο logger:
import * as log from './utils/predictionLogger';

export default function App() {
  const [liveCount, setLiveCount] = useState(0);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const [audioOn, setAudioOn] = useState(false);

  // Ενεργοποίηση/απενεργοποίηση push (phase-7) — χωρίς αλλαγές στο UI theme
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (notificationsOn) {
        try {
          const ok = await registerPush(); // χειρίζεται permissions + /api/push/subscribe
          if (!ok && !cancelled) {
            // Αν αποτύχει, γυρνάμε το toggle off
            setNotificationsOn(false);
          }
        } catch (err) {
          console.error('[push] register failed', err);
          if (!cancelled) setNotificationsOn(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [notificationsOn]);

  // Audio follows the explicit audio toggle (δεν «φωνάζουμε» αν notificationsOff)
  // Το LiveTennis ήδη κάνει gate στα SAFE sounds μέσω notificationsOn.
  const onToggleNotifications = useCallback(() => {
    setNotificationsOn((v) => !v);
    log?.event?.('ui:toggle:notifications', { on: !notificationsOn });
  }, [notificationsOn]);

  const onToggleAudio = useCallback(() => {
    setAudioOn((v) => !v);
    log?.event?.('ui:toggle:audio', { on: !audioOn });
  }, [audioOn]);

  return (
    <div style={{ minHeight: '100vh', background: '#0c0f14' }}>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        onToggleNotifications={onToggleNotifications}
        audioOn={audioOn}
        onToggleAudio={onToggleAudio}
      />

      {/* Το LiveTennis κρατά το παλιό σου layout. Δεν αλλάζουμε styles εδώ. */}
      <div style={{ maxWidth: 980, margin: '16px auto', padding: '0 12px' }}>
        <LiveTennis
          onLiveCount={(n) => setLiveCount(n || 0)}
          notificationsOn={notificationsOn} // gate για SAFE ήχο
          // αν έχεις prop όπως `audioOn` μπορείς να το περάσεις επίσης:
          audioOn={audioOn}
        />
      </div>
    </div>
  );
}