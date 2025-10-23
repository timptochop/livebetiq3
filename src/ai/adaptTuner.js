// src/ai/adaptTuner.js
const DEFAULTS = { minEV: 0.03, safeConf: 0.60, riskyConf: 0.50 };
const FLOORS = { minEV: 0.00, safeConf: 0.52, riskyConf: 0.46 };
const STEPS = { minEV: 0.005, conf: 0.02 };
const NEED_AVOID_COUNT = 8;
const NEED_STREAK = 4;
const COOLDOWN_MS = 3 * 60 * 1000;

function envOn() { try { return String(process.env.REACT_APP_AI_ADAPT) === '1'; } catch { return false; } }
function lsOn() { try { return localStorage.getItem('LBQ_ADAPT') === '1'; } catch { return false; } }
function getCutoffsLS() { try { const raw = localStorage.getItem('LBQ_CUTOFFS'); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function setCutoffsLS(c) { try { localStorage.setItem('LBQ_CUTOFFS', JSON.stringify(c)); } catch {} }
function getState() { try { const raw = localStorage.getItem('LBQ_ADAPT_STATE'); return raw ? JSON.parse(raw) : { noSafeStreak:0, lastStepAt:0 }; } catch { return { noSafeStreak:0, lastStepAt:0 }; } }
function setState(s) { try { localStorage.setItem('LBQ_ADAPT_STATE', JSON.stringify(s)); } catch {} }
function clampCutoffs(c) { return { minEV: Math.max(FLOORS.minEV, c.minEV), safeConf: Math.max(FLOORS.safeConf, c.safeConf), riskyConf: Math.max(FLOORS.riskyConf, c.riskyConf) }; }

export function getCurrentCutoffs() { return getCutoffsLS() || { ...DEFAULTS }; }
export function setCutoffsRuntime(c) { if (!c) return; const next = clampCutoffs({ ...DEFAULTS, ...c }); setCutoffsLS(next); }
export function exportCutoffs() { return getCurrentCutoffs(); }

export function ingestBatch(list) {
  try {
    if (!envOn() && !lsOn()) return;
    const arr = Array.isArray(list) ? list : [];
    const labelCounts = arr.reduce((acc, m) => { const L = String(m?.ai?.label || '').toUpperCase(); if (L) acc[L] = (acc[L] || 0) + 1; return acc; }, {});
    const safe = labelCounts.SAFE || 0;
    const avoid = labelCounts.AVOID || 0;
    const st = getState();
    const now = Date.now();
    if (safe === 0 && avoid >= NEED_AVOID_COUNT) st.noSafeStreak += 1; else st.noSafeStreak = 0;
    if (st.noSafeStreak >= NEED_STREAK && now - st.lastStepAt > COOLDOWN_MS) {
      const cur = getCurrentCutoffs();
      const next = clampCutoffs({ minEV: Math.max(FLOORS.minEV, cur.minEV - STEPS.minEV), safeConf: Math.max(FLOORS.safeConf, cur.safeConf - STEPS.conf), riskyConf: Math.max(FLOORS.riskyConf, cur.riskyConf - STEPS.conf) });
      setCutoffsLS(next);
      st.lastStepAt = now;
    }
    setState(st);
  } catch {}
}

if (typeof window !== 'undefined') {
  window.LBQ = window.LBQ || {};
  window.LBQ.adapt = {
    on: () => localStorage.setItem('LBQ_ADAPT','1'),
    off: () => localStorage.removeItem('LBQ_ADAPT'),
    get: () => ({ cutoffs: getCurrentCutoffs(), state: getState() }),
    reset: () => { localStorage.removeItem('LBQ_CUTOFFS'); localStorage.removeItem('LBQ_ADAPT_STATE'); }
  };
}