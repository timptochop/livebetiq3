import React, { useState } from 'react';
import './LoginModal.css';

function LoginModal({ onClose, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username === 'user' && password === '1234') {
      onLogin(username);
      setUsername('');
      setPassword('');
      setError('');
    } else {
      setError('❌ Invalid credentials');
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>Login</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="error-msg">{error}</div>}
          <button type="submit">Login</button>
          <button type="button" className="cancel" onClick={onClose}>Cancel</button>
        </form>
      </div>
    </div>
  );
}

export default LoginModal;