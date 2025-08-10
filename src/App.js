import React, { useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis';
import './App.css';

function App() {
  const [filters, setFilters] = useState({
    ev: 5,
    confidence: 60,
    label: 'ALL',
    notifications: true,   // default ON όπως ζήτησες
  });

  return (
    <div className="App">
      <TopBar filters={filters} setFilters={setFilters} />
      {/* audio για ειδοποιήσεις */}
      <audio id="notif-audio" src="/notification.mp3" preload="auto" />
      <LiveTennis filters={filters} />
    </div>
  );
}

export default App;