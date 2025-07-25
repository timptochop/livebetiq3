// src/App.js

import React from 'react';
import './App.css';
import './index.css';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis'; // ✅ ΣΩΣΤΟ path, γιατί το αρχείο είναι στο src/

function App() {
  return (
    <div className="App">
      <TopBar />
      <LiveTennis />
    </div>
  );
}

export default App;