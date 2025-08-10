import React, { useEffect, useMemo, useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis';
import './App.css';

const DEFAULT_FILTERS = {
  ev: 5,
  confidence: 60,
  label: 'ALL',
  notifications: true,
};

// helper: median
function median(nums) {
  const a = nums.filter(n => Number.isFinite(n)).sort((x, y) => x - y);
  if (a.length === 0) return NaN;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// AI-based προεπιλογές από τα τρέχοντα δεδομένα
function computeAiDefaults(data = []) {
  if (!data || data.length === 0) return { ...DEFAULT_FILTERS };

  const safe = data.filter(m => m.aiLabel === 'SAFE');
  const risky = data.filter(m => m.aiLabel === 'RISKY');
  const pool = safe.length ? safe : (risky.length ? risky : data);

  const evMed = median(pool.map(m => Number(m.ev)));
  const confMed = median(pool.map(m => Number(m.confidence)));

  // Μικρή εξομάλυνση/ασφάλεια
  const ev = Math.max(5, Math.round(evMed || DEFAULT_FILTERS.ev));
  const confidence = Math.min(100, Math.max(40, Math.round(confMed || DEFAULT_FILTERS.confidence)));

  return { ev, confidence, label: 'ALL', notifications: true };
}

export default function App() {
  // αρχικοποίηση από localStorage
  const initialFilters = useMemo(() => {
    try {
      const raw = localStorage.getItem('filters_v1');
      return raw ? { ...DEFAULT_FILTERS, ...JSON.parse(raw) } : { ...DEFAULT_FILTERS };
    } catch {
      return { ...DEFAULT_FILTERS };
    }
  }, []);

  const [filters, setFilters] = useState(initialFilters);
  const [lastData, setLastData] = useState([]); // οι πιο πρόσφατες προβλέψεις από το LiveTennis

  // save on change
  useEffect(() => {
    try { localStorage.setItem('filters_v1', JSON.stringify(filters)); } catch {}
  }, [filters]);

  // handlers για TopBar
  const handleResetFilters = () => setFilters({ ...DEFAULT_FILTERS });
  const handleAIDefaults = () => setFilters(computeAiDefaults(lastData));

  return (
    <div className="App" style={{ background: '#121212', minHeight: '100vh' }}>
      <TopBar
        filters={filters}
        setFilters={setFilters}
        onReset={handleResetFilters}
        onAIDefault={handleAIDefaults}
      />

      {/* ο player για τα notifications */}
      <audio id="notif-audio" src="/notification.mp3" preload="auto" />

      <LiveTennis
        filters={filters}
        onData={(enriched) => setLastData(enriched)} // παίρνουμε τα enriched για το AI Default
      />
    </div>
  );
}