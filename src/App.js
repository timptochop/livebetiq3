// src/App.js
import React from 'react';
import LiveTennis from './components/LiveTennis';
import TopBar from './components/TopBar';
import TopSpacer from './components/TopSpacer';

function App() {
  return (
    <div className="page">
      <TopSpacer />
      <TopBar />
      <main className="content">
        <h1>🎾 LiveBet IQ – Tennis AI Predictions</h1>
        <LiveTennis />
      </main>
    </div>
  );
}

export default App;