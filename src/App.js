import React, { useEffect, useState } from 'react';
import LiveTennis from './LiveTennis';
import './index.css';
import './components/PredictionCard.css';

function App() {
  const [serverTime, setServerTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setServerTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000); // ανανέωση κάθε 1 λεπτό
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="App" style={{ backgroundColor: '#121212', minHeight: '100vh' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src="/logo192.png" alt="LiveBet IQ Logo" style={{ width: '36px', height: '36px' }} />
        </div>

        {/* Right Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'white', fontSize: '12px' }}>Server Time: {serverTime}</span>
          <span role="img" aria-label="settings" style={{ fontSize: '20px', color: 'white' }}>⚙️</span>
          <span role="img" aria-label="login" style={{ fontSize: '20px', color: 'white' }}>🔐</span>
        </div>
      </div>

      {/* White Separator Line */}
      <div style={{ height: '1px', backgroundColor: 'white', opacity: 0.2, margin: '0 20px' }}></div>

      {/* Main Content */}
      <main style={{ padding: '20px' }}>
        <LiveTennis />
      </main>
    </div>
  );
}

export default App;