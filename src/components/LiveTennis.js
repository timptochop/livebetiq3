// src/components/LiveTennis.js
import React, { useEffect, useMemo, useState } from 'react';
import fetchTennisLive from '../utils/fetchTennisLive';
import analyzeMatch from '../utils/analyzeMatch';

export default function LiveTennis() {
  const [matches, setMatches] = useState([]);
  const [notificationsOn, setNotificationsOn] = useState(false);

  const [filters] = useState({
    minEV: 0.025,
    minConfidence: 55,
    allowedLabels: ['SAFE', 'RISKY', 'STARTS SOON'],
  });

  const playNotificationSound = () => {
    const audio = new Audio('/sounds/notify.mp3');
    audio.play().catch(() => {});
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchTennisLive();
        const rows = res.matches || [];
        setMatches(rows);
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };

    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const analyzedMatches = useMemo(() => {
    return matches
      .map((match) => {
        const analysis = analyzeMatch(match);
        return {
          ...match,
          ...analysis,
        };
      })
      .filter((m) => m.status !== 'finished' && m.status !== 'cancelled');
  }, [matches]);

  useEffect(() => {
    if (!notificationsOn) return;
    const safeMatch = analyzedMatches.find((m) => m.label === 'SAFE');
    if (safeMatch) playNotificationSound();
  }, [analyzedMatches, notificationsOn]);

  return (
    <div
      style={{
        background: '#0a0c0e',
        minHeight: '100vh',
        padding: 'calc(env(safe-area-inset-top, 0px) + 64px) 14px 24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ color: '#fff' }}>Live Tennis</h2>
        <button
          onClick={() => setNotificationsOn((on) => !on)}
          style={{
            background: notificationsOn ? '#16c05f' : '#2c2f32',
            color: '#fff',
            padding: '8px 16px',
            border: 'none',
            borderRadius: 16,
            cursor: 'pointer',
          }}
        >
          Notifications {notificationsOn ? 'ON' : 'OFF'}
        </button>
      </div>

      {analyzedMatches.map((match, i) => {
        const {
          id, status, time, tournament, players = [],
          label, pick, confidence, reason, meta,
        } = match;

        const [p1, p2] = players.map((p) => p.name || '');
        const setNum = meta?.setNum || 1;

        return (
          <div
            key={id || i}
            style={{
              background: '#111',
              border: '1px solid #222',
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
              color: '#eee',
            }}
          >
            <div style={{ fontWeight: 700 }}>
              {p1} <span style={{ color: '#888' }}>vs</span> {p2}
            </div>
            <div style={{ fontSize: 13, color: '#aaa', marginBottom: 4 }}>
              {time} • {tournament}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                background: '#312e81',
                padding: '4px 10px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
              }}>
                SET {setNum}
              </span>

              <span style={{
                background: label === 'SAFE' ? '#10b981'
                  : label === 'RISKY' ? '#f59e0b'
                  : label === 'AVOID' ? '#7c3aed'
                  : label === 'STARTS SOON' ? '#e11d48'
                  : '#444',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: 12,
                fontSize: 13,
                fontWeight: 700,
              }}>
                {label}
              </span>
            </div>

            <div style={{ fontSize: 12, color: '#999', marginTop: 6 }}>
              {reason}
            </div>
          </div>
        );
      })}
    </div>
  );
}