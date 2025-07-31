import React from 'react';

function AIControlPanel({ filters, setFilters }) {
  const handleSliderChange = (type, value) => {
    setFilters((prev) => ({ ...prev, [type]: parseInt(value, 10) }));
  };

  const handleLabelChange = (e) => {
    setFilters((prev) => ({ ...prev, label: e.target.value }));
  };

  const handleNotificationsToggle = () => {
    setFilters((prev) => ({ ...prev, notifications: !prev.notifications }));
  };

  return (
    <div style={{
      backgroundColor: '#1e1e1e',
      padding: '16px',
      borderRadius: '12px',
      color: '#fff',
      fontFamily: 'sans-serif',
      marginTop: '10px'
    }}>
      <div style={{ marginBottom: '14px' }}>
        <label>Min EV: {filters.ev}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.ev}
          onChange={(e) => handleSliderChange('ev', e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label>Min Confidence %: {filters.confidence}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.confidence}
          onChange={(e) => handleSliderChange('confidence', e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label>Filter Label:</label>
        <select
          value={filters.label}
          onChange={handleLabelChange}
          style={{
            width: '100%',
            padding: '6px',
            backgroundColor: '#2c2c2c',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '6px',
            marginTop: '4px'
          }}
        >
          <option value="ALL">All</option>
          <option value="SAFE">Safe</option>
          <option value="RISKY">Risky</option>
          <option value="AVOID">Avoid</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="checkbox"
          checked={filters.notifications}
          onChange={handleNotificationsToggle}
        />
        <label>Enable Notifications</label>
      </div>
    </div>
  );
}

export default AIControlPanel;