/* eslint-disable react-hooks/exhaustive-deps */
// src/LiveTennis.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateEV,
  estimateConfidence,
  generateLabel,
  generateNote,
} from './utils/aiEngineV2';
import './components/PredictionCard.css';

const API_BASE =
  (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) ||
  '/api';

// -------- helpers for set / match phase --------
function deriveCurrentSet(m) {
  // If API provides currentSet, use it
  if (m.currentSet != null) return Number(m.currentSet) || 0;
  // Heuristics for mock/simplified data:
  const time = String(m.time || '').toLowerCase();
  if (time.includes('starts')) return 0;   // not started
  if (time.includes('live')) return 2;     // live but assume pre-3rd set
  return 0;
}

function phaseLabel(m) {
  const cs = deriveCurrentSet(m);
  if (cs === 0) return 'STARTS SOON';
  if (cs > 0 && cs < 3) return 'PENDING';
  return null; // 3rd set+ => let AI decide SAFE/RISKY/AVOID
}

export default function LiveTennis({ filters, onData }) {
  const [predictions, setPredictions] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const seenIdsRef = useRef(new Set());

  // sound + vibration (mobile friendly)
  const notify = () => {
    try {
      const el = document.getElementById('notif-audio');
      if (el) el.play().catch(() => {});
      if (navigator.vibrate) navigator.vibrate(120);
    } catch {}
  };

  const fetchPredictions = async (signal) => {
    try {
      setStatus('loading');
      const res = await fetch(`${API_BASE}/predictions`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const enriched = (data || []).map((m, i) => {
        const ev = m.ev ?? calculateEV(m.odds1, m.odds2, m);
        const confidence = m.confidence ?? estimateConfidence(m.odds1, m.odds2, m);

        // phase based on set
        const phase = phaseLabel(m);

        // If phase exists (STARTS SOON or PENDING) keep that label.
        // Only when phase === null (3rd set +) we let AI decide.
        const aiLabel = phase ?? (m.label ?? generateLabel(ev, confidence));
        const aiNote  = m.note ?? generateNote(aiLabel, ev, confidence);

        return {
          id: m.id ?? `p-${i}`,
          ...m,
          currentSet: deriveCurrentSet(m),
          ev,
          confidence,
          aiLabel,
          aiNote,
        };
      });

      // Notifications: only for 3rd set+ and SAFE/RISKY with EV>5 and unseen ids
      if (filters.notifications) {
        const newImportant = enriched.filter(
          (m) =>
            m.currentSet >= 3 &&
            (m.aiLabel === 'SAFE' || m.aiLabel === 'RISKY') &&
            Number(m.ev) > 5 &&
            !seenIdsRef.current.has(m.id)
        );
        if (newImportant.length > 0) notify();
      }
      enriched.forEach((m) => seenIdsRef.current.add(m.id));

      setPredictions(enriched);
      setStatus('ok');

      if (typeof onData === 'function') onData(enriched);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setStatus('error');
      setErrorMsg(err.message || 'Network error');
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    fetchPredictions(ctrl.signal);
    const t = setInterval(() => fetchPredictions(ctrl.signal), 20000);
    return () => {
      ctrl.abort();
      clearInterval(t);
    };
  }, []); // intentionally no deps to keep steady polling

  const filtered = useMemo(
    () =>
      predictions.filter((m) => {
        // Label filter (supports PENDING as well)
        if (filters.label && filters.label !== 'ALL' && m.aiLabel !== filters.label)
          return false;

        // If label is STARTS SOON or PENDING, don't cut by EV/Conf
        if (m.aiLabel === 'STARTS SOON' || m.aiLabel === 'PENDING') return true;

        // Only for 3rd set+ (SAFE/RISKY/AVOID) apply thresholds:
        if ((m.ev ?? 0) < Number(filters.ev)) return false;
        if ((m.confidence ?? 0) < Number(filters.confidence)) return false;
        return true;
      }),
    [predictions, filters]
  );

  const labelColorMap = {
    SAFE: '#00C853',
    RISKY: '#FFD600',
    AVOID: '#D50000',
    'STARTS SOON': '#B0BEC5',
    PENDING: '#90A4AE',
  };
  const labelColor = (label) => labelColorMap[label] || '#FFFFFF';

  // add paddingTop so the sticky TopBar doesn't overlap the first cards
  return (
    <div style={{ background: '#121212', minHeight: '100vh', paddingTop: 84 }}>
      {status === 'loading' && (
        <div style={{ color: '#bbb', textAlign: 'center', paddingTop: 24 }}>
          Loading...
        </div>
      )}
      {status === 'error' && (
        <div style={{ color: '#ff6b6b', textAlign: 'center', paddingTop: 24 }}>
          Failed to fetch ({errorMsg}).{' '}
          {API_BASE.startsWith('http') ? `API: ${API_BASE}` : 'Using /api'}
        </div>
      )}

      <div className={`prediction-list ${filtered.length === 1 ? 'single' : ''}`}>
        {filtered.map((m) => (
          <div key={m.id} className="prediction-card">
            <div className="top-row">
              <span className="match-name">
                {m.player1} vs {m.player2}
                {m.currentSet ? ` · Set ${m.currentSet}` : ''}
              </span>
              <span
                className="label"
                style={{ backgroundColor: labelColor(m.aiLabel) }}
              >
                {m.aiLabel}
              </span>
            </div>

            {m.currentSet >= 3 ? (
              <>
                <div className="info-row">
                  <span className="info-item">EV: {Number(m.ev).toFixed(1)}%</span>
                  <span className="info-item">
                    Conf: {Number(m.confidence).toFixed(0)}%
                  </span>
                </div>
                <div className="note">
                  <em>{m.aiNote}</em>
                </div>
              </>
            ) : (
              <div className="note">
                <em>
                  {m.aiLabel === 'STARTS SOON'
                    ? 'Match has not started yet.'
                    : 'Live match before 3rd set — waiting for stronger signal.'}
                </em>
              </div>
            )}
          </div>
        ))}
      </div>

      {status === 'ok' && filtered.length === 0 && (
        <div style={{ color: '#888', textAlign: 'center', padding: 24 }}>
          No matches match your filters yet.
        </div>
      )}
    </div>
  );
}