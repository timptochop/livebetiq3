import React, { useState, useEffect } from 'react';
import './App.css';
import './index.css';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis';
import LoginModal from './components/LoginModal';

function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState(localStorage.getItem('loggedInUser') || '');

  const handleLogin = (username) => {
    localStorage.setItem('loggedInUser', username);
    setUser(username);
    setShowLogin(false);
  };

  useEffect(() => {
    const checkLogin = () => {
      const storedUser = localStorage.getItem('loggedInUser') || '';
      setUser(storedUser);
    };
    checkLogin();
    window.addEventListener('storage', checkLogin);
    return () => window.removeEventListener('storage', checkLogin);
  }, []);

  return (
    <div className="App">
      <TopBar onLoginClick={() => setShowLogin(true)} user={user} />
      <LiveTennis />
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
    </div>
  );
}

export default App;