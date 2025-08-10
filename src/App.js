// src/App.js
import React, { useEffect, useRef, useState } from 'react';
import TopBar from './components/TopBar';
import LiveTennis from './LiveTennis';
import './App.css';

const LS_KEY = 'lb_filters_v1';

const DEFAULT_FILTERS = {
  ev: 5,
  confidence: 60,
  label: 'ALL',
  notifications: true,
};

function loadFilters() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const obj = JSON.parse(raw);
    return { ...DEFAULT_FILTERS, ...obj };
  } catch {
    return DEFAULT_FILTERS;
  }
}

function saveFilters(f) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(f));
  } catch {}
}

export default function App() {
  const [filters, setFilters] = useState(loadFilters);
  const lastDataRef = useRef([]);               // κρατάει το τελευταίο enriched dataset
  const userTouchedRef = useRef(false);         // για να μην “πατάμε” τον χρήστη
  const aiAppliedRef = useRef(false);           // εφαρμόστηκε ήδη AI default;

  // κάθε φορά που αλλάζουν φίλτρα → σώσε στο localStorage
  useEffect(() => { saveFilters(filters); }, [filters]);

  // wrapper ώστε όταν αλλάζει κάτι από τον χρήστη να το ξέρουμε
  const setFiltersTouched = (updater) => {
    userTouchedRef.current = true;
    setFilters((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  };

  // λογική “AI default”: πάρε το καλύτερο SAFE, αλλιώς το καλύτερο RISKY
  const computeAIDefault = (data = []) => {
    if (!Array.isArray(data) || data.length === 0) return null;
    const sortByEV = (a, b) => Number(b.ev ?? 0) - Number(a.ev ?? 0);

    const safe = data.filter(m => m.aiLabel === 'SAFE').sort(sortByEV)[0];
    const risky = data.filter(m => m.aiLabel === 'RISKY').sort(sortByEV)[0];
    const pick = safe || risky || null;
    if (!pick) return null;

    const evTarget = Math.max(5, Math.floor(Number(pick.ev) || 0));
    const confTarget = Math.max(50, Math.round(Number(pick.confidence) || 0));
    const labelTarget = pick.aiLabel;

    return { ev: evTarget, confidence: confTarget, label: labelTarget };
  };

  // όταν έρχονται νέα δεδομένα από το LiveTennis
  const handleData = (enriched) => {
    lastDataRef.current = enriched || [];
    // εφάρμοσε αυτόματα AI default ΜΟΝΟ μία φορά & μόνο αν ο χρήστης δεν έχει πειράξει φίλτρα
    if (!aiAppliedRef.current && !userTouchedRef.current) {
      const ai = computeAIDefault(lastDataRef.current);
      if (ai) {
        setFilters((prev) => ({ ...prev, ...ai }));
        aiAppliedRef.current = true;
      }
    }
  };

  // Reset → πήγαινε στο AI default (αν δεν υπάρχει data, γύρνα στα default)
  const handleReset = () => {
    const ai = computeAIDefault(lastDataRef.current);
    if (ai) {
      setFilters((prev) => ({ ...prev, ...ai }));
    } else {
      setFilters({ ...DEFAULT_FILTERS });
    }
    // ο χρήστης “άγγιξε” φίλτρα με reset, οπότε μην ξαναεπιβάλλουμε AI αυτόματα
    userTouchedRef.current = true;
  };

  return (
    <div style={{ background: '#121212', minHeight: '100vh' }}>
      <TopBar
        filters={filters}
        setFilters={setFiltersTouched}
        onReset={handleReset}
      />

      {/* Η λίστα με τα παιχνίδια + callback για data */}
      <LiveTennis filters={filters} onData={handleData} />

      {/* ήχος ειδοποίησης για SAFE/RISKY */}
      <audio id="notif-audio" src="/notify.mp3" preload="auto" />
    </div>
  );
}