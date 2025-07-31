import React from 'react';

const AIControlPanel = ({ filters, setFilters }) => {
  const handleSliderChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: parseInt(value) }));
  };

  const handleLabelChange = (e) => {
    setFilters((prev) => ({ ...prev, label: e.target.value }));
  };

  const handleNotificationsToggle = (e) => {
    setFilters((prev) => ({ ...prev, notifications: e.target.checked }));
  };

  return (
    <div
      style={{
        backgroundColor: '#1e1e1e',
        borderRadius: '12px',
        padding: '16px 10px 20px 20px', // εδώ μεταφέρουμε ΟΛΟ το box πιο αριστερά
        margin: '8px',
        color: 'white',
        fontSize: '15px',
      }}
    >
      <div style={{ marginBottom: '12px', marginLeft: '-12px' }}>
        <label>Min EV %: {filters.ev}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.ev}
          onChange={(e) => handleSliderChange('ev', e.target.value)}
          style={{ width: '100%' }}
        />
      </div>
      <div style={{ marginBottom: '12px', marginLeft: '-12px' }}>
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
      <div style={{ marginBottom: '12px', marginLeft: '-12px' }}>
        <label>Filter Label:</label>
        <select
          value={filters.label}
          onChange={handleLabelChange}
          style={{ width: '100%', padding: '6px' }}
        >
          <option value="ALL">All</option>
          <option value="SAFE">Safe</option>
          <option value="RISKY">Risky</option>
          <option value="AVOID">Avoid</option>
        </select>
      </div>
      <div style={{ marginLeft: '-12px' }}>
        <label>
          <input
            type="checkbox"
            checked={filters.notifications}
            onChange={handleNotificationsToggle}
            style={{ marginRight: '8px' }}
          />
          Enable Notifications
        </label>
      </div>
    </div>
  );
};

export default AIControlPanel;