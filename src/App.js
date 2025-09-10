import React from 'react';
import LiveTennis from './components/LiveTennis';

function App() {
  return (
    <main style={{ backgroundColor: '#111', color: '#fff', minHeight: '100vh', padding: '24px' }}>
      <h1>🎾 LiveBet IQ – Tennis AI Predictions</h1>
      <LiveTennis />
    </main>
  );
}

export default App;