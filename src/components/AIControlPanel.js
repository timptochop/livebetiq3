import React from 'react';

const AIControlPanel = ({ filters, setFilters }) => {
  const inputStyle = {
    width: '100%',
    height: '3px',
    marginBottom: '6px',
  };

  const labelStyle = {
    fontSize: '11px',
    marginBottom: '2px',
  };

  const selectStyle = {
    fontSize: '11px',
    padding: '2px',
    height: '24px',
    marginBottom: '8px',
  };

  const containerStyle = {
    backgroundColor: '#1e1e1e',
    padding: '10px',
    borderRadius: '10px',
    fontSize: '12px',
    color: 'white',
    width: '92%',
    margin: 'auto',
  };

  const checkboxRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '11px',
  };

  return (
    <div style={containerStyle}>
      <div>
        <label style={labelStyle}>Min EV %: {filters.ev}</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.ev}
          onChange={(e) =>
            setFilters({ ...filters, ev: parseInt(e.target.value) })
          }
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Min Confidence %: {filters.confidence}</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.confidence}
          onChange={(e) =>
            setFilters({
              ...filters,
              confidence: parseInt(e.target.value),
            })
          }
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Filter Label:</label>
        <select
          value={filters.label}
          onChange={(e) =>
            setFilters({ ...filters, label: e.target.value })
          }
          style={selectStyle}
        >
          <option value="ALL">All</option>
          <option value="SAFE">Safe</option>
          <option value="RISKY">Risky</option>
          <option value="AVOID">Avoid</option>
        </select>
      </div>

      <div style={checkboxRowStyle}>
        <label>Enable Notifications</label>
        <input
          type="checkbox"
          checked={filters.notificationsEnabled}
          onChange={(e) =>
            setFilters({
              ...filters,
              notificationsEnabled: e.target.checked,
            })
          }
        />
      </div>
    </div>
  );
};

export default AIControlPanel;