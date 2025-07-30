import React, { useState } from 'react';

function LoginModal({ onClose, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username === 'user' && password === '1234') {
      onLogin(username);
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000
    }}>
      <form onSubmit={handleSubmit} style={{
        backgroundColor: '#1e1e1e',
        padding: '20px',
        borderRadius: '8px',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '80%',
        maxWidth: '320px'
      }}>
        <h3 style={{ margin: 0 }}>Login</h3>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: '10px', borderRadius: '4px', border: 'none' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '10px', borderRadius: '4px', border: 'none' }}
        />
        {error && <div style={{ color: 'red' }}>{error}</div>}
        <button type="submit" style={{ padding: '10px', backgroundColor: '#00C853', color: 'white', border: 'none', borderRadius: '4px' }}>
          Login
        </button>
        <button type="button" onClick={onClose} style={{ padding: '8px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '4px' }}>
          Cancel
        </button>
      </form>
    </div>
  );
}

export default LoginModal;