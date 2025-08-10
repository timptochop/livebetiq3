// src/LiveTennis.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  calculateEV,
  estimateConfidence,
  generateLabel,
  generateNote,
} from './utils/aiPredictionEngine';
import './components/PredictionCard.css';

const API_BASE =
  (process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL.trim()) || '/api';

export default function LiveTennis({ filters, onData }) {
  const [predictions, setPredictions] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // Κρατάμε ids που έχουμε ήδη “δει”, για να μην ξανα-κάνουμε notify.
  const seenIdsRef = useRef(new Set());

  // Backoff state για το polling
  const intervalMsRef = useRef(20000); // ξεκινά στα 20s
  const timerRef = useRef(null);

  // helper: play sound + vibration (mobile friendly)
  const notify = () => {
    try {
      const el = document.getElementById('notif-audio');
      if (el) el.play?.().catch(() => {});
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
        const aiLabel = m.label ?? generateLabel(ev, confidence);
        const aiNote = m.note ?? generateNote(aiLabel, ev, confidence);
        return { id: m.id ?? `p-${i}`, ...m, ev, confidence, aiLabel, aiNote };
      });

      // Notifications: νέα SAFE/RISKY με EV > 5 που δεν τα είχαμε ξαναδεί
      if (filters.notifications) {
        const newImportant = enriched.filter(
          (m) =>
            (m.aiLabel === 'SAFE' || m.aiLabel === 'RISKY') &&
            Number(m.ev) > 5 &&
            !seenIdsRef.current.has(m.id)
        );
        if (newImportant.length > 0) notify();
      }

      // Trim του seen set αν μικρύνει το dataset (να μη μένουν άσχετα ids)
      const nowIds = new Set(enriched.map((m) => m.id));
      seenIdsRef.current.forEach((id) => {
        if (!nowIds.has(id)) seenIdsRef.current.delete(id);
      });
      // προσθήκη των τωρινών ids
      enriched.forEach((m) => seenIdsRef.current.add(m.id));

      setPredictions(enriched);
      setStatus('ok');
      setErrorMsg('');

      // επιτυχία ⇒ reset backoff
      intervalMsRef.current = 20000;

      // δίνουμε τα enriched στο parent (για AI default logic)
      if (typeof onData === 'function') onData(enriched);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setStatus('error');
      setErrorMsg(err.message || 'Network error');

      // αποτυχία ⇒ αυξάνουμε διάστημα μέχρι 120s
      intervalMsRef.current = Math.min(intervalMsRef.current * 2, 120000);
    }
  };

  // Polling με backoff (setTimeout loop αντί για setInterval)
  useEffect(() => {
    const ctrl = new AbortController();

    const tick = async () => {
      await fetchPredictions(ctrl.signal);
      timerRef.current = setTimeout(tick, intervalMsRef.current);
    };

    tick(); // start immediately

    return () => {
      ctrl.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []); // run once

  // Αν αλλάξει το label filter, καθαρίζουμε το seen ώστε να μπορέσουν να έρθουν νέα notify
  useEffect(() => {
    seenIdsRef.current.clear();
  }, [filters.label]);

  const filtered = useMemo(
    () =>
      predictions.filter((m) => {
        if ((m.ev ?? 0) < Number(filters.ev)) return false;
        if ((m.confidence ?? 0) < Number(filters.confidence)) return false;
        if (filters.label && filters.label !== 'ALL' && m.aiLabel !== filters.label) return false;
        return true;
      }),
    [predictions, filters]
  );

  const labelColor = (label) =>
    ({ SAFE: '#00C853', RISKY: '#FFD600', AVOID: '#D50000', 'STARTS SOON': '#B0BEC5' }[label] ||
      '#FFFFFF');

  return (
    <div style={{ background: '#121212', minHeight: '100vh' }}>
      {status === 'loading' && (
        <div style={{ color: '#bbb', textAlign: 'center', paddingTop: 24 }}>Loading...</div>
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
              </span>
              <span className="label" style={{ backgroundColor: labelColor(m.aiLabel) }}>
                {m.aiLabel}
              </span>
            </div>
            <div className="info-row">
              <span className="info-item">EV: {Number(m.ev).toFixed(1)}%</span>
              <span className="info-item">Conf: {Number(m.confidence).toFixed(0)}%</span>
            </div>
            <div className="note">
              <em>{m.aiNote}</em>
            </div>
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