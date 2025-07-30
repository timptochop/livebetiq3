// src/components/LoginModal.js
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
      setError('Invalid username or password');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: '#1e1e1e',
        padding: '24px',
        borderRadius: '8px',
        width: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        color: 'white'
      }}>
        <h3 style={{ marginBottom: '16px' }}>Login</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
          {error && <p style={{ color: 'red', fontSize: '14px' }}>{error}</p>}
          <button type="submit" style={buttonStyle}>Login</button>
        </form>
        <button onClick={onClose} style={{ ...buttonStyle, backgroundColor: '#444', marginTop: '10px' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '10px',
  marginBottom: '10px',
  borderRadius: '4px',
  border: '1px solid #555',
  backgroundColor: '#2a2a2a',
  color: 'white'
};

const buttonStyle = {
  width: '100%',
  padding: '10px',
  backgroundColor: '#00C853',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer'
};

export default LoginModal;