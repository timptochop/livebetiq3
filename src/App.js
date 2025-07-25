import React from 'react';
import LiveTennis from './LiveTennis';
import './index.css';
import './components/PredictionCard.css';

function App() {
  return (
    <div className="App" style={{ backgroundColor: '#121212', minHeight: '100vh', padding: '20px' }}>
      
      {/* Top Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        
        {/* Logo Only */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo192.png" alt="LiveBet IQ Logo" style={{ width: '40px', height: '40px' }} />
        </div>

        {/* Settings + Login Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="https://cdn-icons-png.flaticon.com/512/3524/3524659.png" 
               alt="Settings"
               style={{ width: '22px', height: '22px', filter: 'invert(1)', cursor: 'pointer' }}
          />
          <img src="https://cdn-icons-png.flaticon.com/512/1828/1828479.png" 
               alt="Login"
               style={{ width: '22px', height: '22px', filter: 'invert(1)', cursor: 'pointer' }}
          />
        </div>
      </header>

      {/* White Divider */}
      <hr style={{ border: 'none', borderTop: '1px solid #ffffff', margin: '12px 0' }} />

      {/* Static Text for Date and Time */}
      <div style={{ color: '#ffffff', fontSize: '15px', marginBottom: '24px' }}>
        Παρασκευή, 25 Ιουλίου 2025 – Ενημερώθηκε στις 16:07
      </div>

      {/* Main Match Area */}
      <main>
        <LiveTennis />
      </main>
    </div>
  );
}

export default App;