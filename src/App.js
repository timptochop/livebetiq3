import React, { useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './components/LiveTennis';
import './App.css';

export default function App() {
  const [showAIBadges, setShowAIBadges] = useState(true);
  const [liveCount, setLiveCount] = useState(0); // ενημερώνεται από το LiveTennis

  return (
    <div>
      <TopBar
        liveCount={liveCount}
        showAIBadges={showAIBadges}
        onToggleAIBadges={setShowAIBadges}
      />
      <LiveTennis
        showAIBadges={showAIBadges}
        onLiveCount={setLiveCount}
      />
    </div>
  );
}