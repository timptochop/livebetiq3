// src/components/AIControlPanel.js
import React, { useEffect, useState } from 'react';
import './AIControlPanel.css';
import fetchLbqConfig from '../utils/fetchLbqConfig'; // πρέπει να υπάρχει (είναι το endpoint στο GAS)

function AIControlPanel({ filters, setFilters }) {
  const [remoteCfg, setRemoteCfg] = useState(null);
  const [cfgStatus, setCfgStatus] = useState('idle');

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setCfgStatus('loading');
        const cfg = await fetchLbqConfig();
        if (!mounted) return;

        const normalized = {
          ev: Number(cfg.ev ?? 0.3),
          confidence: Number(cfg.confidence ?? 0.25),
          momentum: Number(cfg.momentum ?? 0.15),
          drift: Number(cfg.drift ?? 0.1),
          surface: Number(cfg.surface ?? 0.1),
          form: Number(cfg.form ?? 0.1),
          _generatedAt: cfg._generatedAt || null,
          _version: cfg._version || 'v5.0-phase1',
          _source: cfg._source || 'lbq-config',
        };

        setRemoteCfg(normalized);
        setCfgStatus('ok');

        // debug για εμάς
        // eslint-disable-next-line no-console
        console.group('[LBQ] remote config');
        // eslint-disable-next-line no-console
        console.table(normalized);
        // eslint-disable-next-line no-console
        console.groupEnd();
      } catch (err) {
        if (!mounted) return;
        setCfgStatus('error');
        // eslint-disable-next-line no-console
        console.warn('LBQ: failed to fetch remote config', err);
      }
    };

    load();
    const timer = setInterval(load, 30 * 60 * 1000); // refresh ανά 30'
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="ai-control-panel">
      {/* EV slider */}
      <div className="ai-control-group">
        <span className="ai-control-label">Min EV %:</span>
        <input
          type="range"
          className="ai-slider"
          min="0"
          max="100"
          value={filters.ev}
          onChange={(e) =>
            setFilters({ ...filters, ev: parseInt(e.target.value, 10) })
          }
        />
        <span className="ai-value">{filters.ev}</span>
      </div>

      {/* Confidence slider */}
      <div className="ai-control-group">
        <span className="ai-control-label">Min Conf %:</span>
        <input
          type="range"
          className="ai-slider"
          min="0"
          max="100"
          value={filters.confidence}
          onChange={(e) =>
            setFilters({
              ...filters,
              confidence: parseInt(e.target.value, 10),
            })
          }
        />
        <span className="ai-value">{filters.confidence}</span>
      </div>

      {/* Label filter */}
      <div className="ai-control-group">
        <span className="ai-control-label">Filter Label:</span>
        <select
          className="ai-select"
          value={filters.label}
          onChange={(e) => setFilters({ ...filters, label: e.target.value })}
        >
          <option value="ALL">All</option>
          <option value="SAFE">SAFE</option>
          <option value="RISKY">RISKY</option>
          <option value="AVOID">AVOID</option>
        </select>
      </div>

      {/* Notifications */}
      <div className="ai-control-group">
        <label className="ai-control-label">
          <input
            type="checkbox"
            className="ai-checkbox"
            checked={filters.notifications}
            onChange={(e) =>
              setFilters({ ...filters, notifications: e.target.checked })
            }
          />{' '}
          Notifications
        </label>
      </div>

      {/* --- ΝΕΟ: read-only snapshot από GAS --- */}
      <div className="ai-remote-box">
        <div className="ai-remote-title">Remote LBQ Config</div>
        {cfgStatus === 'loading' && (
          <div className="ai-remote-row">loading…</div>
        )}
        {cfgStatus === 'error' && (
          <div className="ai-remote-row ai-remote-error">
            failed → using local defaults
          </div>
        )}
        {cfgStatus === 'ok' && remoteCfg && (
          <>
            <div className="ai-remote-row">ev: {remoteCfg.ev}</div>
            <div className="ai-remote-row">
              confidence: {remoteCfg.confidence}
            </div>
            <div className="ai-remote-row">momentum: {remoteCfg.momentum}</div>
            <div className="ai-remote-row">drift: {remoteCfg.drift}</div>
            <div className="ai-remote-row">surface: {remoteCfg.surface}</div>
            <div className="ai-remote-row">form: {remoteCfg.form}</div>
            <div className="ai-remote-meta">
              {remoteCfg._version} • {remoteCfg._source}
            </div>
            {remoteCfg._generatedAt && (
              <div className="ai-remote-meta">{remoteCfg._generatedAt}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AIControlPanel;