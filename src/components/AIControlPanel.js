// src/components/AIControlPanel.js
import React from 'react';

function AIControlPanel({ filters, setFilters }) {
  const handleSliderChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: Number(value) }));
  };

  const handleLabelChange = (e) => {
    setFilters(prev => ({ ...prev, label: e.target.value }));
  };

  const handleToggleNotifications = () => {
    setFilters(prev => ({
      ...prev,
      notifications: !prev.notifications
    }));
  };

  return (
    <div style={{
      backgroundColor: '#2c2c2c',
      padding: '16px',
      borderRadius: '8px',
      color: 'white',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      fontSize: '14px'
    }}>
      <label>
        Min EV %: {filters.ev}
        <input
          type="range"
          name="ev"
          min="0"
          max="100"
          step="1"
          value={filters.ev}
          onChange={handleSliderChange}
          style={{ width: '100%' }}
        />
      </label>

      <label>
        Min Confidence %: {filters.confidence}
        <input
          type="range"
          name="confidence"
          min="0"
          max="100"
          step="1"
          value={filters.confidence}
          onChange={handleSliderChange}
          style={{ width: '100%' }}
        />
      </label>

      <label>
        Prediction Type:
        <select
          value={filters.label}
          onChange={handleLabelChange}
          style={{ width: '100%', padding: '4px', borderRadius: '4px', marginTop: '4px' }}
        >
          <option value="ALL">ALL</option>
          <option value="SAFE">SAFE</option>
          <option value="RISKY">RISKY</option>
          <option value="AVOID">AVOID</option>
          <option value="STARTS SOON">STARTS SOON</option>
        </select>
      </label>

      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Enable Notifications
        <input
          type="checkbox"
          checked={filters.notifications || false}
          onChange={handleToggleNotifications}
        />
      </label>
    </div>
  );
}

export default AIControlPanel;