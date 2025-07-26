// src/App.js
import React from 'react';
import './App.css';
import './index.css';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis'; // μπορείς να βάλεις ό,τι θέλεις εδώ

function App() {
  return (
    <div className="App">
      <TopBar />
      <LiveTennis />
    </div>
  );
}

export default App;