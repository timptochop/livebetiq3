import React from 'react';
import './App.css';
import LiveTennis from './components/LiveTennis';
import TopBar from './components/TopBar';

function App() {
  return (
    <div className="App">
      <TopBar />
      <LiveTennis />
    </div>
  );
}

export default App;