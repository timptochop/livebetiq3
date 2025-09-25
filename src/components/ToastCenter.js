import React, { useEffect, useState } from 'react';

export default function ToastCenter() {
  const [queue, setQueue] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    function onToast(ev) {
      const detail = ev.detail || {};
      const item = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        text: String(detail.text || 'Notice'),
        timeout: Number(detail.timeout || 3000),
      };
      setQueue(q => [...q, item]);
    }
    window.addEventListener('LBQ_TOAST', onToast);
    return () => window.removeEventListener('LBQ_TOAST', onToast);
  }, []);

  useEffect(() => {
    if (active || queue.length === 0) return;
    const [next, ...rest] = queue;
    setActive(next);
    setQueue(rest);
    const t = setTimeout(() => setActive(null), next.timeout);
    return () => clearTimeout(t);
  }, [queue, active]);

  if (!active) return null;

  return (
    <div style={{
      position: 'fixed',
      left: 0, right: 0, bottom: 20,
      display: 'flex', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 9999
    }}>
      <div style={{
        pointerEvents: 'auto',
        padding: '10px 14px',
        borderRadius: 12,
        background: '#0f1115',
        border: '1px solid #273142',
        color: '#e8f0ff',
        fontWeight: 800,
        boxShadow: '0 10px 40px rgba(0,0,0,0.45)',
        maxWidth: '90%',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        overflow: 'hidden'
      }}>
        {active.text}
      </div>
    </div>
  );
}