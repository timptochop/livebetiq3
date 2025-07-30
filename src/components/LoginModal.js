// src/components/LoginModal.js
import React, { useState } from 'react';
import './LoginModal.css';

function LoginModal({ onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = () => {
    if (username === 'user' && password === '1234') {
      localStorage.setItem('loggedInUser', username);
      onClose(); // Close the modal
      window.location.reload(); // Refresh to update TopBar
    } else {
      setError('Invalid credentials');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Login</h3>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="error">{error}</div>}
        <div className="modal-buttons">
          <button onClick={handleLogin}>Login</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default LoginModal;