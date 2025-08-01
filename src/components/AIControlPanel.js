import React from 'react';

const AIControlPanel = ({ filters, setFilters }) => {
  const handleSliderChange = (key) => (e) => {
    const value = parseInt(e.target.value, 10);
    setFilters((prev) => ({ ...prev, [key]: value }));
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
        backgroundColor: '#1E1E1E',
        padding: '10px 12px',
        borderRadius: '12px',
        width: '90%',
        margin: '0 auto',
        fontSize: '13px',
      }}
    >
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '2px' }}>
          Min EV %: {filters.ev}
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.ev}
          onChange={handleSliderChange('ev')}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '2px' }}>
          Min Confidence %: {filters.confidence}
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.confidence}
          onChange={handleSliderChange('confidence')}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', marginBottom: '2px' }}>Filter Label:</label>
        <select
          value={filters.label}
          onChange={handleLabelChange}
          style={{
            width: '100%',
            padding: '4px 6px',
            fontSize: '13px',
            backgroundColor: '#2C2C2C',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '4px',
          }}
        >
          <option value="ALL">All</option>
          <option value="SAFE">Safe</option>
          <option value="RISKY">Risky</option>
          <option value="AVOID">Avoid</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={filters.notifications}
            onChange={handleNotificationsToggle}
          />
          Enable Notifications
        </label>
      </div>
    </div>
  );
};

export default AIControlPanel;