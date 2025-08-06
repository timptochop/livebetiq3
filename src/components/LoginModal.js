import React, { useState } from 'react';

function LoginModal({ onLogin, onClose }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(username.trim(), password.trim());
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <h2 style={titleStyle}>Login</h2>
        <form onSubmit={handleSubmit}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Username:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
              autoFocus
            />
          </div>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={buttonGroupStyle}>
            <button type="submit" style={loginButtonStyle}>
              Login
            </button>
            <button type="button" onClick={onClose} style={cancelButtonStyle}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Styles
const modalOverlayStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 2000
};

const modalStyle = {
  backgroundColor: '#1e1e1e',
  padding: '30px',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '360px',
  boxShadow: '0 0 12px rgba(0,0,0,0.8)',
  color: '#fff'
};

const titleStyle = {
  marginBottom: '20px',
  fontSize: '22px',
  textAlign: 'center'
};

const inputGroupStyle = {
  marginBottom: '15px'
};

const labelStyle = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '14px'
};

const inputStyle = {
  width: '100%',
  padding: '10px',
  fontSize: '16px',
  borderRadius: '6px',
  border: '1px solid #ccc',
  backgroundColor: '#2c2c2c',
  color: '#fff'
};

const buttonGroupStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '20px'
};

const loginButtonStyle = {
  padding: '10px 20px',
  backgroundColor: '#00C853',
  color: '#000',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  flex: 1,
  marginRight: '10px'
};

const cancelButtonStyle = {
  padding: '10px 20px',
  backgroundColor: '#444',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  flex: 1
};

export default LoginModal;