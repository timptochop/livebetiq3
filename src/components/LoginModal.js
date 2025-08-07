import React, { useState } from 'react';

const LoginModal = ({ onClose, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (username === 'user' && password === '1234') {
      onLoginSuccess(username);
    } else {
      alert('Invalid credentials');
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h3>Login</h3>
        <input
          style={styles.input}
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleLogin} style={styles.button}>Login</button>
        <button onClick={onClose} style={styles.button}>Cancel</button>
      </div>
    </div>
  );
};

const styles = {
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 999,
  },
  modalContent: {
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 10,
    color: '#fff',
    minWidth: '300px',
    textAlign: 'center',
  },
  input: {
    width: '90%',
    padding: '8px',
    margin: '10px 0',
    borderRadius: 4,
    border: '1px solid #ccc',
  },
  button: {
    margin: '10px 5px',
    padding: '8px 16px',
    borderRadius: 4,
    border: 'none',
    backgroundColor: '#28a745',
    color: 'white',
    cursor: 'pointer',
  },
};

export default LoginModal;