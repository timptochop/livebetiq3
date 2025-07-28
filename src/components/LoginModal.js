// src/components/LoginModal.js
import React from 'react';
import './LoginModal.css';

const LoginModal = ({ onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-btn" onClick={onClose}>✖</button>
        <h2>Login</h2>
        <input type="text" placeholder="Username" />
        <input type="password" placeholder="Password" />
        <button className="login-btn">Login</button>
      </div>
    </div>
  );
};

export default LoginModal;