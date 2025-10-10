// src/hooks/useLiveCount.js
import { useEffect } from 'react';

const EVT_LIVE_COUNT = 'live-count';

export default function useLiveCount(list) {
  const count = Array.isArray(list) ? list.length : 0;

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.__LIVE_COUNT__ = count;
        window.dispatchEvent(new CustomEvent(EVT_LIVE_COUNT, { detail: count }));
      }
    } catch {}
  }, [count]);
}