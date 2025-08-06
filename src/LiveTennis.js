import React, { useState, useEffect } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis';
import LoginModal from './components/LoginModal';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [filters, setFilters] = useState({
    ev: 5,
    confidence: 60,
    label: 'ALL',
    notifications: false
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('loggedInUser');
    if (storedUser) setIsLoggedIn(true);
  }, []);

  const handleLogin = (username, password) => {
    if (username === 'user' && password === '1234') {
      localStorage.setItem('loggedInUser', username);
      setIsLoggedIn(true);
      setShowLogin(false);
    } else {
      alert('Invalid credentials');
    }
  };

  return (
    <div className="App">
      <TopBar
        isLoggedIn={isLoggedIn}
        onLoginClick={() => setShowLogin(true)}
        filters={filters}
        setFilters={setFilters}
      />
      <LiveTennis filters={filters} />
      {showLogin && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}

export default App;