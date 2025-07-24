import React from 'react';
import LiveTennis from './LiveTennis';
import './index.css';

function App() {
  return (
    <div className="App">
      <div className="container">
        {/* Logo από public, σωστή χρήση */}
        <img src="/logo192.png" alt="LiveBet IQ" className="logo" />
        <LiveTennis />
      </div>
    </div>
  );
}

export default App;