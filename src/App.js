// src/App.js
import React from 'react';
import LiveTennis from './components/LiveTennis';
import './App.css';

export default function App() {
  // Το TopBar γίνεται render μέσα στο LiveTennis — δεν το βάζουμε εδώ δεύτερη φορά.
  return <LiveTennis />;
}