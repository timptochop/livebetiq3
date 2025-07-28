import React, { useState } from 'react';
import './LoginModal.css';

function LoginModal({ onClose, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (username === 'user' && password === '1234') {
      onLogin(username);
      onClose();
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
        <button onClick={handleSubmit}>Login</button>
        <button className="cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default LoginModal;