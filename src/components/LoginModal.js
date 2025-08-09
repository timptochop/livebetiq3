import React from 'react';
import './LoginModal.css';

function LoginModal({ onClose, onLogin }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleLogin = () => {
    if (username === 'user' && password === '1234') {
      onLogin(username);
      onClose();
    } else {
      alert('Invalid credentials');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Login</h2>
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
        <button onClick={handleLogin}>Login</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default LoginModal;