
// src/components/AIControlPanel.js
import React from 'react';
import './AIControlPanel.css';

function AIControlPanel({ filters, setFilters }) {
  return (
    <div className="ai-panel-container">
      <div className="small-control-group">
        <label>Min EV %: {filters.ev}</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.ev}
          onChange={(e) =>
            setFilters({ ...filters, ev: parseInt(e.target.value) })
          }
        />
      </div>

      <div className="small-control-group">
        <label>Min Confidence %: {filters.confidence}</label>
        <input
          type="range"
          min="0"
          max="100"
          value={filters.confidence}
          onChange={(e) =>
            setFilters({ ...filters, confidence: parseInt(e.target.value) })
          }
        />
      </div>

      <div className="small-control-group">
        <label>Filter Label:</label>
        <select
          value={filters.label}
          onChange={(e) => setFilters({ ...filters, label: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="SAFE">SAFE</option>
          <option value="RISKY">RISKY</option>
          <option value="AVOID">AVOID</option>
        </select>
      </div>

      <div className="small-control-group">
        <label>
          <input
            type="checkbox"
            checked={filters.notifications}
            onChange={(e) =>
              setFilters({ ...filters, notifications: e.target.checked })
            }
          />
          Enable Notifications
        </label>
      </div>
    </div>
  );
}

export default AIControlPanel;