import React, { useState, useEffect } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './components/LiveTennis';
import LoginModal from './components/LoginModal';
import './App.css';

function App() {
  const [filters, setFilters] = useState({
    minEV: 0,
    minConfidence: 0,
    label: 'All',
    notificationsEnabled: true,
  });

  const [loggedInUser, setLoggedInUser] = useState(localStorage.getItem('loggedInUser') || null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    if (loggedInUser) {
      localStorage.setItem('loggedInUser', loggedInUser);
    } else {
      localStorage.removeItem('loggedInUser');
    }
  }, [loggedInUser]);

  return (
    <div className="App">
      <TopBar
        onLoginClick={() => setIsLoginModalOpen(true)}
        loggedInUser={loggedInUser}
        filters={filters}
        setFilters={setFilters}
      />
      <LiveTennis filters={filters} notificationsEnabled={filters.notificationsEnabled} />
      {isLoginModalOpen && (
        <LoginModal
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={(user) => {
            setLoggedInUser(user);
            setIsLoginModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default App;