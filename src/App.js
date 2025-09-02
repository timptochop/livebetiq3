// src/App.js
import React, { useState, useCallback } from "react";
import TopBar from "./components/TopBar";
import LiveTennis from "./components/LiveTennis";
import "./App.css";

// Απλός Error Boundary για να μην μένει μαύρη οθόνη αν κάτι σκάσει
class ErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state = { hasError: false, err: null }; }
  static getDerivedStateFromError(err){ return { hasError: true, err }; }
  componentDidCatch(err, info){ console.error("UI ERROR:", err, info); }
  render(){
    if(this.state.hasError){
      return (
        <div style={{ padding: 16, color: "#fff" }}>
          <h3>Κάτι πήγε στραβά στο UI.</h3>
          <pre style={{ whiteSpace: "pre-wrap", color:"#ffb3b3" }}>
            {(this.state.err && (this.state.err.message || String(this.state.err))) || "Unknown error"}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [liveCount, setLiveCount] = useState(0);
  const [notificationsOn, setNotificationsOn] = useState(false);

  const handleLiveCount = useCallback((n) => {
    if (Number.isFinite(n)) setLiveCount(n);
  }, []);

  const TOPBAR_H = 72; // ίδιο με TopBar

  return (
    <>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        onToggleNotifications={setNotificationsOn}
      />

      {/* spacer ίσο με το ύψος του fixed topbar */}
      <div style={{ height: TOPBAR_H }} />

      <main style={{ minHeight: "100vh", background: "#0b0b0b" }}>
        <ErrorBoundary>
          <LiveTennis onLiveCount={handleLiveCount} />
        </ErrorBoundary>
      </main>
    </>
  );
}