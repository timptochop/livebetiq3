import React, { useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis';
import './App.css';

export default function App() {
  const [filters, setFilters] = useState({ ev: 5, confidence: 60, label: 'ALL', notifications: false });
  return (
    <div className="App">
      <TopBar filters={filters} setFilters={setFilters} />
      <LiveTennis filters={filters} />
    </div>
  );
}