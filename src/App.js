import React from 'react';
import LiveTennis from './LiveTennis';
import './index.css';

function App() {
  return (
    <div className="App">
      <div className="container">
        <img src="/logo192.png" alt="LiveBet IQ Logo" className="logo" />
        <LiveTennis />
      </div>
    </div>
  );
}

export default App;