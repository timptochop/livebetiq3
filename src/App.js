// src/App.js
import React, { useState } from 'react';
import './App.css';
import './index.css';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis';
import LoginModal from './components/LoginModal';

function App() {
  const [showLogin, setShowLogin] = useState(false);

  return (
    <div className="App">
      <TopBar onLoginClick={() => setShowLogin(true)} />
      <LiveTennis />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

export default App;