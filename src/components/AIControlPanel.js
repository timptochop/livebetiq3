import React from 'react';
import './AIControlPanel.css';

function AIControlPanel({ filters, setFilters }) {
  return (
    <div className="ai-control-panel">
      <div className="control-group">
        <label>Min EV %</label>
        <input
          type="range"
          min="0"
          max="20"
          step="1"
          value={filters.ev}
          onChange={(e) => setFilters(prev => ({ ...prev, ev: Number(e.target.value) }))}
        />
        <span>{filters.ev}%</span>
      </div>

      <div className="control-group">
        <label>Min Confidence %</label>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={filters.confidence}
          onChange={(e) => setFilters(prev => ({ ...prev, confidence: Number(e.target.value) }))}
        />
        <span>{filters.confidence}%</span>
      </div>

      <div className="control-group">
        <label>Label</label>
        <select
          value={filters.label}
          onChange={(e) => setFilters(prev => ({ ...prev, label: e.target.value }))}
        >
          <option value="ALL">ALL</option>
          <option value="SAFE">SAFE</option>
          <option value="RISKY">RISKY</option>
          <option value="AVOID">AVOID</option>
          <option value="STARTS SOON">STARTS SOON</option>
        </select>
      </div>
    </div>
  );
}

export default AIControlPanel;