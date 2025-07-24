import React from 'react';
import LiveTennis from './LiveTennis';
import './index.css';
import './components/PredictionCard.css';

function App() {
  return (
    <div className="App" style={{ backgroundColor: '#121212', minHeight: '100vh', padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo192.png" alt="LiveBet IQ Logo" style={{ width: '40px', height: '40px' }} />
          <h1 style={{ color: 'white', fontSize: '22px' }}>LiveBet IQ</h1>
        </div>
        <div>
          {/* Κλειδωνιά - placeholder για login */}
          <span role="img" aria-label="lock" style={{ fontSize: '22px', color: '#ffffff' }}>🔒</span>
        </div>
      </header>

      <main style={{ marginTop: '30px' }}>
        <LiveTennis />
      </main>
    </div>
  );
}

export default App;