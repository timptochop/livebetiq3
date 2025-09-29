import React, { useCallback, useEffect, useState } from "react";
import TopBar from "./components/TopBar";
import TopSpacer from "./components/TopSpacer";
import LiveTennis from "./components/LiveTennis";
import ToastCenter from "./components/ToastCenter";

const LS_NOTIFY = "lbq_notify_on";
const LS_AUDIO  = "lbq_audio_on";

export default function App() {
  const [liveCount, setLiveCount] = useState(0);
  const [notificationsOn, setNotificationsOn] = useState(() => {
    return (typeof localStorage !== "undefined" ? localStorage.getItem(LS_NOTIFY) : null) !== "0";
  });
  const [audioOn, setAudioOn] = useState(() => {
    return (typeof localStorage !== "undefined" ? localStorage.getItem(LS_AUDIO) : null) !== "0";
  });

  // συγχρονισμός με global event από LiveTennis (fallback)
  useEffect(() => {
    const handler = (e) => setLiveCount(Number(e.detail || window.__LIVE_COUNT__ || 0));
    window.addEventListener("live-count", handler);
    return () => window.removeEventListener("live-count", handler);
  }, []);

  const toggleNotifications = useCallback(() => {
    setNotificationsOn(v => {
      const nv = !v; try { localStorage.setItem(LS_NOTIFY, nv ? "1" : "0"); } catch {}
      return nv;
    });
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioOn(v => {
      const nv = !v; try { localStorage.setItem(LS_AUDIO, nv ? "1" : "0"); } catch {}
      return nv;
    });
  }, []);

  return (
    <>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        audioOn={audioOn}
        onToggleNotifications={toggleNotifications}
        onToggleAudio={toggleAudio}
      />
      <TopSpacer />
      <ToastCenter />
      <main className="container" data-scroll-root>
        <LiveTennis
          onLiveCount={setLiveCount}      /* ενημερώνει το TopBar */
          notificationsOn={notificationsOn}
          audioOn={audioOn}
          notifyMode="ONCE"
        />
      </main>
    </>
  );
}