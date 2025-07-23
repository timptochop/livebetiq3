import React from 'react';
import LiveTennis from './LiveTennis';

function App() {
  // Dummy matches για testing
  const matches = [
    {
      title: 'Alexander Zverev vs Roberto Bautista Agut',
      label: 'SAFE',
    },
    {
      title: 'Taro Daniel vs Luca Nardi',
      label: 'RISKY',
    },
    {
      title: 'Denis Shapovalov vs Taro Daniel',
      label: 'AVOID',
    },
    {
      title: 'Linda Noskova vs Katie Boulter',
      label: 'STARTS SOON',
    },
  ];

  return (
    <div className="app">
      <LiveTennis matches={matches} />
    </div>
  );
}

export default App;