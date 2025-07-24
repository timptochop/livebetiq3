import React from 'react';
import LiveTennis from './LiveTennis';
import './index.css';

function App() {
  return (
    <div className="App">
      <div className="container">
        {/* Logo updated for redeploy */}
        <img src="/logo192.png" alt="LiveBetIQ v1" className="logo" />
        <LiveTennis />
      </div>
    </div>
  );
}

export default App;