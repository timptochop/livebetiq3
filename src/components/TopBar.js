import React, { useEffect, useState } from 'react';
import LoginModal from './LoginModal';
import './TopBar.css';

function TopBar() {
  const [currentTime, setCurrentTime] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState(localStorage.getItem('loggedInUser') || '');

  useEffect(() => {
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
    localStorage.setItem('loggedInUser', username);
    setUser(username);
    setShowLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('loggedInUser');
    setUser('');
  };

  return (
    <div className="topbar">
      <div className="topbar-inner">
        <img src="/logo192.png" alt="Logo" className="topbar-logo" />
        <span className="topbar-time">{currentTime}</span>
        <div className="topbar-icons">
          <i className="fas fa-cog"></i>
          {user ? (
            <>
              <span className="topbar-user">User: <span className="green">{user}</span></span>
              <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <i className="fas fa-user" onClick={handleLoginClick}></i>
          )}
        </div>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
      <hr className="topbar-divider" />
    </div>
  );
}

export default TopBar;