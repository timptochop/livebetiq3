import React, { useEffect, useState } from 'react';
import LoginModal from './LoginModal';
import './TopBar.css';

function TopBar() {
  const [currentTime, setCurrentTime] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState('');

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
    localStorage.setItem('loggedInUser', username);
    setShowLogin(false);
  };

  return (
    <>
      <div className="top-bar">
        <div className="left">
          <img src="/logo192.png" alt="Logo" className="logo" />
        </div>
        <div className="center">{currentTime}</div>
        <div className="right">
          <span className="icon">&#9881;</span> {/* settings */}
          <span className="icon" onClick={handleLoginClick}>
            &#128100; {user}
          </span>
        </div>
      </div>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={handleLogin} />}
    </>
  );
}

export default TopBar;