import React from 'react';
import './AIControlPanel.css';

const AIControlPanel = ({ filters, setFilters }) => {
  return (
    <div className="ai-control-panel">
      <div className="control-row">
        <label className="control-label">Min EV %: {filters.ev}</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.ev}
          onChange={(e) =>
            setFilters({ ...filters, ev: parseInt(e.target.value) })
          }
          className="small-slider"
        />
      </div>

      <div className="control-row">
        <label className="control-label">
          Min Confidence %: {filters.confidence}
        </label>
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
          className="small-slider"
        />
      </div>

      <div className="control-row">
        <label className="control-label">Filter Label:</label>
        <select
          value={filters.label}
          onChange={(e) =>
            setFilters({ ...filters, label: e.target.value })
          }
          className="small-select"
        >
          <option value="ALL">All</option>
          <option value="SAFE">Safe</option>
          <option value="RISKY">Risky</option>
          <option value="AVOID">Avoid</option>
        </select>
      </div>

      <div className="control-row checkbox-row">
        <label className="control-label">Enable Notifications</label>
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