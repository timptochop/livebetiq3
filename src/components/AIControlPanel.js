// src/components/AIControlPanel.js
import React from 'react';

const AIControlPanel = ({ filters, setFilters }) => {
  const handleSliderChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const handleLabelChange = (e) => {
    setFilters((prev) => ({ ...prev, label: e.target.value }));
  };

  const handleToggleNotifications = (e) => {
    setFilters((prev) => ({ ...prev, notifications: e.target.checked }));
  };

  return (
    <div style={styles.panel}>
      <div style={styles.row}>
        <label style={styles.label}>Min EV %:</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.ev}
          onChange={(e) => handleSliderChange('ev', e.target.value)}
          style={styles.slider}
        />
        <span style={styles.value}>{filters.ev}%</span>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Min Confidence %:</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.confidence}
          onChange={(e) => handleSliderChange('confidence', e.target.value)}
          style={styles.slider}
        />
        <span style={styles.value}>{filters.confidence}%</span>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Filter Label:</label>
        <select
          value={filters.label}
          onChange={handleLabelChange}
          style={styles.select}
        >
          <option value="ALL">All</option>
          <option value="SAFE">Safe</option>
          <option value="RISKY">Risky</option>
          <option value="AVOID">Avoid</option>
        </select>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>Enable Notifications</label>
        <input
          type="checkbox"
          checked={filters.notifications || false}
          onChange={handleToggleNotifications}
          style={styles.checkbox}
        />
      </div>
    </div>
  );
};

const styles = {
  panel: {
    backgroundColor: '#1e1e1e',
    padding: '8px',
    borderRadius: '8px',
    fontSize: '9px',
    color: '#fff',
    width: '100%',
    boxSizing: 'border-box',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '6px',
  },
  label: {
    flex: 1,
    fontSize: '9px',
    marginRight: '4px',
  },
  slider: {
    flex: 2,
    height: '6px',
  },
  value: {
    marginLeft: '4px',
    fontSize: '9px',
    width: '28px',
    textAlign: 'right',
  },
  select: {
    flex: 2,
    fontSize: '9px',
    padding: '2px',
  },
  checkbox: {
    width: '12px',
    height: '12px',
    marginLeft: '4px',
  },
};

export default AIControlPanel;