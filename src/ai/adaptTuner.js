// src/ai/adaptTuner.js
const DEFAULTS = { minEV: 0.03, thrSafe: 0.60, thrRisky: 0.50 };
const FLOORS   = { minEV: 0.00, thrSafe: 0.52, thrRisky: 0.46 };
const STEPS    = { minEV: 0.005, conf: 0.02 };
const NEED_AVOID_COUNT = 8;
const NEED_STREAK = 4;
const COOLDOWN_MS = 3 * 60 * 1000;

function envOn() { try { return String(process.env.REACT_APP_AI_ADAPT) === '1'; } catch { return false; } }
function lsOn()  { try { return localStorage.getItem('LBQ_ADAPT') === '1'; } catch { return false; } }

function normalize(src) {
  const c = src && typeof src === 'object' ? { ...src } : {};
  const thrSafe  = typeof c.thrSafe  === 'number' ? c.thrSafe  :
                   typeof c.safeConf === 'number' ? c.safeConf : undefined;
  const thrRisky = typeof c.thrRisky === 'number' ? c.thrRisky :
                   typeof c.riskyConf=== 'number' ? c.riskyConf: undefined;
  const minEV    = typeof c.minEV    === 'number' ? c.minEV    : undefined;
  const out = { ...DEFAULTS };
  if (typeof minEV    === 'number') out.minEV    = minEV;
  if (typeof thrSafe  === 'number') out.thrSafe  = thrSafe;
  if (typeof thrRisky === 'number') out.thrRisky = thrRisky;
  return out;
}

function clampCutoffs(c) {
  return {
    minEV:    Math.max(FLOORS.minEV,    Number.isFinite(c.minEV) ? c.minEV : DEFAULTS.minEV),
    thrSafe:  Math.max(FLOORS.thrSafe,  Number.isFinite(c.thrSafe) ? c.thrSafe : DEFAULTS.thrSafe),
    thrRisky: Math.max(FLOORS.thrRisky, Number.isFinite(c.thrRisky) ? c.thrRisky : DEFAULTS.thrRisky)
  };
}

function fixOrder(c) {
  if (c.thrSafe < c.thrRisky) {
    const mid = (c.thrSafe + c.thrRisky) / 2;
    c.thrRisky = Math.max(FLOORS.thrRisky, mid - 0.02);
    c.thrSafe  = Math.max(FLOORS.thrSafe,  mid + 0.02);
  }
  return c;
}

function getCutoffsLS() {
  try {
    const raw = localStorage.getItem('LBQ_CUTOFFS');
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch { return null; }
}
function setCutoffsLS(c) { try { localStorage.setItem('LBQ_CUTOFFS', JSON.stringify(c)); } catch {} }

function getState() {
  try {
    const raw = localStorage.getItem('LBQ_ADAPT_STATE');
    return raw ? JSON.parse(raw) : { noSafeStreak: 0, lastStepAt: 0 };
  } catch { return { noSafeStreak: 0, lastStepAt: 0 }; }
}
function setState(s) { try { localStorage.setItem('LBQ_ADAPT_STATE', JSON.stringify(s)); } catch {} }

export function getCurrentCutoffs() {
  const c = getCutoffsLS() || { ...DEFAULTS };
  return { ...c, safeConf: c.thrSafe, riskyConf: c.thrRisky };
}

export function setCutoffsRuntime(c) {
  if (!c) return;
  const next = fixOrder(clampCutoffs(normalize({ ...DEFAULTS, ...c })));
  setCutoffsLS(next);
}

export function exportCutoffs() {
  const c = getCurrentCutoffs();
  return { thrSafe: c.thrSafe, thrRisky: c.thrRisky, minEV: c.minEV };
}

export function ingestBatch(list) {
  try {
    if (!envOn() && !lsOn()) return;
    const arr = Array.isArray(list) ? list : [];
    const labelCounts = arr.reduce((acc, m) => {
      const L = String(m?.ai?.label || '').toUpperCase();
      if (L) acc[L] = (acc[L] || 0) + 1;
      return acc;
    }, {});
    const safe = labelCounts.SAFE || 0;
    const avoid = labelCounts.AVOID || 0;

    const st = getState();
    const now = Date.now();

    if (safe === 0 && avoid >= NEED_AVOID_COUNT) st.noSafeStreak += 1; else st.noSafeStreak = 0;

    if (st.noSafeStreak >= NEED_STREAK && now - st.lastStepAt > COOLDOWN_MS) {
      const cur = getCurrentCutoffs();
      const next = fixOrder(clampCutoffs({
        minEV:    Math.max(FLOORS.minEV,    cur.minEV    - STEPS.minEV),
        thrSafe:  Math.max(FLOORS.thrSafe,  cur.thrSafe  - STEPS.conf),
        thrRisky: Math.max(FLOORS.thrRisky, cur.thrRisky - STEPS.conf)
      }));
      setCutoffsLS(next);
      st.lastStepAt = now;
    }

    setState(st);
  } catch {}
}

if (typeof window !== 'undefined') {
  window.LBQ = window.LBQ || {};
  window.LBQ.adapt = {
    on:   () => localStorage.setItem('LBQ_ADAPT', '1'),
    off:  () => localStorage.removeItem('LBQ_ADAPT'),
    get:  () => ({ cutoffs: getCurrentCutoffs(), state: getState() }),
    reset: () => {
      localStorage.removeItem('LBQ_CUTOFFS');
      localStorage.removeItem('LBQ_ADAPT_STATE');
    }
  };
}