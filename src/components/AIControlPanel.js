// src/components/AIControlPanel.js
import React from 'react';

function AIControlPanel({ filters, setFilters }) {
  const handleSliderChange = (type, value) => {
    setFilters((prev) => ({ ...prev, [type]: parseInt(value, 10) }));
  };

  const handleLabelChange = (e) => {
    setFilters((prev) => ({ ...prev, label: e.target.value }));
  };

  const handleNotificationsToggle = () => {
    setFilters((prev) => ({ ...prev, notificationsEnabled: !prev.notificationsEnabled }));
  };

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: '#1e1e1e',
        borderRadius: '12px',
        color: '#fff',
        maxWidth: '100%',
        boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        marginTop: '12px',
      }}
    >
      <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <label style={{ marginBottom: '6px' }}>Min EV: {filters.ev}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.ev}
          onChange={(e) => handleSliderChange('ev', e.target.value)}
          style={{ width: '95%', marginLeft: '8px' }}
        />
      </div>

      <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <label style={{ marginBottom: '6px' }}>Min Confidence %: {filters.confidence}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.confidence}
          onChange={(e) => handleSliderChange('confidence', e.target.value)}
          style={{ width: '95%', marginLeft: '8px' }}
        />
      </div>

      <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <label style={{ marginBottom: '6px' }}>Filter Label:</label>
        <select
          value={filters.label}
          onChange={handleLabelChange}
          style={{
            width: '95%',
            marginLeft: '8px',
            padding: '6px',
            backgroundColor: '#2c2c2c',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: '6px',
          }}
        >
          <option value="ALL">All</option>
          <option value="SAFE">Safe</option>
          <option value="RISKY">Risky</option>
          <option value="AVOID">Avoid</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', marginTop: '12px', marginLeft: '8px' }}>
        <input
          type="checkbox"
          checked={filters.notificationsEnabled}
          onChange={handleNotificationsToggle}
          id="notificationsToggle"
        />
        <label htmlFor="notificationsToggle" style={{ marginLeft: '8px' }}>
          Enable Notifications
        </label>
      </div>
    </div>
  );
}

export default AIControlPanel;
