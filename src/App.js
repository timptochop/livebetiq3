import React, { useState } from 'react';
import './App.css';
import './index.css';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis';
import LoginModal from './components/LoginModal';

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(localStorage.getItem('loggedInUser') || '');

  const handleLogin = (username) => {
    setLoggedInUser(username);
    localStorage.setItem('loggedInUser', username);
    setShowLogin(false);
  };

  return (
    <div className="App">
      <TopBar user={loggedInUser} onLoginClick={() => setShowLogin(true)} />
      <LiveTennis />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
    </div>
  );
}

export default App;