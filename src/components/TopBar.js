import React, { useEffect, useState } from 'react';

function TopBar({ onLoginClick }) {
  const [currentTime, setCurrentTime] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('loggedInUser'));

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hh}:${mm}`);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleStorage = () => {
      setIsLoggedIn(!!localStorage.getItem('loggedInUser'));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      padding: '10px 16px 0',
      position: 'fixed',
      top: 0,
      width: '100%',
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <img
            src="/logo192.png"
            alt="Logo"
            style={{ width: '40px', height: '40px', marginLeft: '-6px', borderRadius: '50%' }}
          />
        </div>

        {/* Right Section */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '18px',
          transform: 'translateX(-18px)'  // 3 βήματα αριστερά (6px ανά βήμα)
        }}>
          {/* Settings Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="#ccc"
            viewBox="0 0 24 24"
          >
            <path d="M19.14 12.936a7.493 7.493 0 0 0 .057-.936c0-.318-.02-.63-.057-.936l2.037-1.593a.468.468 0 0 0 .111-.588l-1.929-3.34a.467.467 0 0 0-.564-.21l-2.4.96a7.42 7.42 0 0 0-1.617-.936l-.363-2.52a.45.45 0 0 0-.45-.39h-3.858a.45.45 0 0 0-.45.39l-.363 2.52a7.42 7.42 0 0 0-1.617.936l-2.4-.96a.46.46 0 0 0-.564.21l-1.93 3.34a.465.465 0 0 0 .112.588l2.037 1.593c-.037.306-.057.618-.057.936 0 .318.02.63.057.936l-2.037 1.593a.468.468 0 0 0-.111.588l1.929 3.34a.467.467 0 0 0 .564.21l2.4-.96c.504.384 1.05.705 1.617.936l.363 2.52c.03.225.225.39.45.39h3.858c.225 0 .42-.165.45-.39l.363-2.52c.567-.231 1.113-.552 1.617-.936l2.4.96a.467.467 0 0 0 .564-.21l1.929-3.34a.468.468 0 0 0-.111-.588l-2.037-1.593ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z" />
          </svg>

          {/* Login Icon */}
          <div
            onClick={onLoginClick}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              fill={isLoggedIn ? '#00C853' : '#ccc'}
              viewBox="0 0 24 24"
            >
              <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
            </svg>
          </div>

          {/* Time */}
          <span style={{
            color: 'white',
            fontSize: '13px',
            transform: 'translateX(12px)' // 2 βήματα δεξιά
          }}>
            {currentTime}
          </span>
        </div>
      </div>

      {/* Elegant Full-Width Line */}
      <div style={{ marginTop: '12px', marginBottom: '20px', width: '100%' }}>
        <div style={{
          height: '2px',
          background: 'linear-gradient(to right, transparent, white, transparent)',
          width: '100%'
        }} />
      </div>
    </div>
  );
}

export default TopBar;