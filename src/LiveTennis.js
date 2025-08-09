// src/LiveTennis.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  calculateEV,
  estimateConfidence,
  generateLabel,
  generateNote,
} from './utils/aiPredictionEngine';
import './components/PredictionCard.css';

// Αν δώσεις REACT_APP_API_URL χρησιμοποιείται αυτό (π.χ. http://localhost:5000).
// Αλλιώς, στο Vercel θα χτυπάει το serverless route /api/predictions.
const API_BASE = (process.env.REACT_APP_API_URL || '').trim() || '/api';

export default function LiveTennis({ filters }) {
  const [predictions, setPredictions] = useState([]);
  const [status, setStatus] = useState('idle');   // idle | loading | ok | error
  const [errorMsg, setErrorMsg] = useState('');

  async function fetchPredictions(signal) {
    try {
      setStatus('loading');
      setErrorMsg('');
      const res = await fetch(`${API_BASE}/predictions`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const enriched = (data || []).map((m, i) => {
        const ev = m.ev ?? calculateEV(m.odds1, m.odds2, m);
        const confidence = m.confidence ?? estimateConfidence(m.odds1, m.odds2, m);
        const aiLabel = m.label ?? generateLabel(ev, confidence);
        const aiNote = m.note ?? generateNote(aiLabel, ev, confidence);
        return { id: m.id ?? `p-${i}`, ...m, ev, confidence, aiLabel, aiNote };
      });

      setPredictions(enriched);
      setStatus('ok');
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setStatus('error');
      setErrorMsg(err?.message || 'Network error');
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchPredictions(ctrl.signal);
    const t = setInterval(() => fetchPredictions(ctrl.signal), 20000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, []);

  const filtered = useMemo(() => {
    return predictions.filter((m) => {
      if ((m.ev ?? 0) < Number(filters.ev)) return false;
      if ((m.confidence ?? 0) < Number(filters.confidence)) return false;
      if (filters.label && filters.label !== 'ALL' && m.aiLabel !== filters.label) return false;
      return true;
    });
  }, [predictions, filters]);

  const labelColor = (label) => {
    switch (label) {
      case 'SAFE': return '#00C853';
      case 'RISKY': return '#FFD600';
      case 'AVOID': return '#D50000';
      case 'STARTS SOON': return '#B0BEC5';
      default: return '#FFFFFF';
    }
  };

  return (
    <div style={{ background: '#121212', padding: '80px 16px 20px', minHeight: '100vh' }}>
      {status === 'loading' && (
        <div style={{ color: '#bbb', textAlign: 'center', marginTop: 24 }}>Loading…</div>
      )}

      {status === 'error' && (
        <div style={{ color: '#ff6b6b', textAlign: 'center', marginTop: 24 }}>
          Failed to fetch ({errorMsg}).{' '}
          {API_BASE.startsWith('http') ? `API: ${API_BASE}` : 'Using /api function'}
        </div>
      )}

      {filtered.map((m) => (
        <div key={m.id} className="prediction-card">
          <div className="top-row">
            <span className="match-name">{m.player1} vs {m.player2}</span>
            <span className="label" style={{ backgroundColor: labelColor(m.aiLabel) }}>
              {m.aiLabel}
            </span>
          </div>
          <div className="info-row">
            <span className="info-item">EV: {Number(m.ev).toFixed(1)}%</span>
            <span className="info-item">Conf: {Number(m.confidence).toFixed(0)}%</span>
          </div>
          <div className="note"><em>{m.aiNote}</em></div>
        </div>
      ))}

      {status === 'ok' && filtered.length === 0 && (
        <div style={{ color: '#888', textAlign: 'center', marginTop: 24 }}>
          No matches match your filters yet.
        </div>
      )}
    </div>
  );
}