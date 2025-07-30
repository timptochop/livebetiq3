// src/App.js
import React, { useState } from 'react';
import './App.css';
import './index.css';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis';
import LoginModal from './components/LoginModal';

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState(localStorage.getItem('loggedInUser') || '');

  const handleLogin = (username) => {
    setUser(username);
    localStorage.setItem('loggedInUser', username);
    setShowLogin(false);
  };

  return (
    <div className="App">
      <TopBar onLoginClick={() => setShowLogin(true)} user={user} />
      <LiveTennis />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
    </div>
  );
}

export default App;