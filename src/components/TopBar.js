import React, { useEffect, useState } from 'react';
import LoginModal from './LoginModal';
import './TopBar.css';

function TopBar() {
  const [currentTime, setCurrentTime] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState('');
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('loggedInUser');
    if (savedUser) setUser(savedUser);

    const interval = setInterval(() => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      setCurrentTime(`${hh}:${mm}`);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLoginClick = () => setShowLogin(true);

  const handleLogin = (username) => {
    setUser(username);
    setWelcome(true);
    localStorage.setItem('loggedInUser', username);
    setTimeout(() => {
      setWelcome(false);
    }, 5000);
  };

  return (
    <div className="top-bar-container">
      <div className="top-bar">
        <img src="/logo192.png" alt="Logo" className="top-bar-logo" />
        <span className="top-bar-time">{currentTime}</span>
        <div className="top-bar-icons">
          <span className="top-bar-icon">⚙️</span>
          <span className="top-bar-icon" onClick={handleLoginClick}>
            {user
              ? welcome
                ? `Welcome ${user}!`
                : `User: ${user}`
              : 'Login'}
          </span>
        </div>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
      <hr className="top-bar-divider" />
    </div>
  );
}

export default TopBar;