import React, { useEffect, useState } from 'react';

function LiveTennis() {
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    // Mock fetch for testing
    async function fetchData() {
      const data = [
        { id: 1, title: 'Alexander Zverev vs Roberto Bautista Agut', label: 'SAFE', isLive: true },
        { id: 2, title: 'Taro Daniel vs Luca Nardi', label: 'RISKY', isLive: true },
        { id: 3, title: 'Denis Shapovalov vs Taro Daniel', label: 'AVOID', isLive: false },
        { id: 4, title: 'Linda Noskova vs Katie Boulter', label: 'STARTS SOON', isLive: false },
      ];
      setMatches(data);
    }
    fetchData();
  }, []);

  const getTagClass = (label) => {
    if (label === 'SAFE') return 'tag safe';
    if (label === 'RISKY') return 'tag risky';
    if (label === 'AVOID') return 'tag avoid';
    return 'tag soon';
  };

  return (
    <div>
      {matches.map((match) => (
        <div key={match.id} className="match-card">
          <div className="left-section">
            <div className={`status-dot ${match.isLive ? 'live' : 'not-live'}`}></div>
            <img src="/logo192.png" alt="Logo" style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
            <div className="vertical-line"></div>
          </div>
          <div className="match-info">
            <div className="match-title">{match.title}</div>
            <div className={getTagClass(match.label)}>{match.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default LiveTennis;