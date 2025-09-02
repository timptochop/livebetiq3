// src/App.js
import React, { useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './components/LiveTennis';
import './App.css';

export default function App() {
  const [liveCount, setLiveCount] = useState(0);

  return (
    <div style={{ background: '#0b0b0b', minHeight: '100vh' }}>
      <TopBar
        liveCount={liveCount}
        onBellClick={() => {}}
        onLoginClick={() => {}}
      />
      <LiveTennis onLiveCount={setLiveCount} />
    </div>
  );
}