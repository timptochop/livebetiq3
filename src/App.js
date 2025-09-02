// src/App.js
import React, { useState, useCallback } from "react";
import TopBar from "./components/TopBar";
import LiveTennis from "./components/LiveTennis";
import "./App.css";

// Μικρός ErrorBoundary για να μη μένει μαύρη οθόνη αν κάτι κρασάρει
class ErrorBoundary extends React.Component {
  constructor(p){ super(p); this.state = { hasError:false, err:null }; }
  static getDerivedStateFromError(err){ return { hasError:true, err }; }
  componentDidCatch(err, info){ console.error("UI ERROR:", err, info); }
  render(){
    if(this.state.hasError){
      return (
        <div style={{ padding:16, color:"#fff" }}>
          <h3>Κάτι πήγε στραβά στο UI.</h3>
          <pre style={{ whiteSpace:"pre-wrap", color:"#ffb3b3" }}>
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

  // Το ύψος του οπτικού τμήματος της μπάρας (ίδιο με TopBar BAR_H)
  const BAR_H = 64;
  const safeTop = "env(safe-area-inset-top, 0px)";

  return (
    <>
      <TopBar
        liveCount={liveCount}
        notificationsOn={notificationsOn}
        onToggleNotifications={setNotificationsOn}
      />

      {/* padding-top στο main = bar height + safe-area */}
      <main
        style={{
          minHeight: "100vh",
          background: "#0b0b0b",
          paddingTop: `calc(${safeTop} + ${BAR_H}px)`,
        }}
      >
        <ErrorBoundary>
          <LiveTennis onLiveCount={handleLiveCount} />
        </ErrorBoundary>
      </main>
    </>
  );
}