// src/ai/adaptiveLoop.js
const STORAGE_KEY = 'LBQ_FEEDBACK_LOG';
const MAX_ITEMS = 200;
const ADAPT_INTERVAL_MS = 15 * 60 * 1000;

function ts() {
  return new Date().toISOString();
}

function readLog() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
    return [];
  } catch {
    return [];
  }
}

function writeLog(items) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    /* ignore */
  }
}

export function pushFeedback(entry) {
  const base = readLog();
  const next = Array.isArray(base) ? base.slice() : [];
  next.push({
    ts: entry?.ts || ts(),
    label: entry?.label || '',
    result: entry?.result || 'unknown',
    conf: typeof entry?.conf === 'number' ? entry.conf : null,
    ev: typeof entry?.ev === 'number' ? entry.ev : null,
    matchId: entry?.matchId || null,
  });
  writeLog(next);
  return next;
}

function computeStats(items) {
  const out = {
    total: 0,
    safe: { total: 0, win: 0 },
    risky: { total: 0, win: 0 },
    avoid: { total: 0, hit: 0 },
  };
  for (const it of items) {
    out.total += 1;
    const label = String(it.label || '').toUpperCase();
    const win = String(it.result || '').toLowerCase() === 'win';
    const lose = String(it.result || '').toLowerCase() === 'lose';
    if (label === 'SAFE') {
      out.safe.total += 1;
      if (win) out.safe.win += 1;
    } else if (label === 'RISKY') {
      out.risky.total += 1;
      if (win) out.risky.win += 1;
    } else if (label === 'AVOID') {
      out.avoid.total += 1;
      if (lose) out.avoid.hit += 1;
    }
  }
  out.safe.hitRate = out.safe.total ? out.safe.win / out.safe.total : null;
  out.risky.hitRate = out.risky.total ? out.risky.win / out.risky.total : null;
  out.avoid.hitRate = out.avoid.total ? out.avoid.hit / out.avoid.total : null;
  return out;
}

function currentWeights() {
  if (typeof window !== 'undefined' && window.__LBQ_WEIGHTS__ && typeof window.__LBQ_WEIGHTS__ === 'object') {
    return {
      ev: Number(window.__LBQ_WEIGHTS__.ev || 0.3),
      confidence: Number(window.__LBQ_WEIGHTS__.confidence || 0.25),
      momentum: Number(window.__LBQ_WEIGHTS__.momentum || 0.15),
      drift: Number(window.__LBQ_WEIGHTS__.drift || 0.1),
      surface: Number(window.__LBQ_WEIGHTS__.surface || 0.1),
      form: Number(window.__LBQ_WEIGHTS__.form || 0.1),
    };
  }
  return {
    ev: 0.3,
    confidence: 0.25,
    momentum: 0.15,
    drift: 0.1,
    surface: 0.1,
    form: 0.1,
  };
}

function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function applyAdaptive(stats) {
  if (typeof window === 'undefined') return null;
  const w = currentWeights();
  let changed = false;

  if (stats.safe.hitRate !== null) {
    if (stats.safe.hitRate < 0.82) {
      w.confidence = clamp(w.confidence + 0.01, 0.15, 0.35);
      w.momentum = clamp(w.momentum - 0.01, 0.05, 0.25);
      changed = true;
    } else if (stats.safe.hitRate > 0.9) {
      w.momentum = clamp(w.momentum + 0.01, 0.05, 0.25);
      changed = true;
    }
  }

  if (stats.risky.hitRate !== null) {
    if (stats.risky.hitRate < 0.6) {
      w.ev = clamp(w.ev + 0.01, 0.25, 0.4);
      changed = true;
    } else if (stats.risky.hitRate > 0.75) {
      w.ev = clamp(w.ev - 0.005, 0.2, 0.4);
      changed = true;
    }
  }

  if (changed) {
    window.__LBQ_WEIGHTS__ = w;
    window.__LBQ_WEIGHTS_META__ = {
      generatedAt: ts(),
      source: 'adaptive-loop',
      version: 'v6.0-phase3',
    };
  }
  return { changed, weights: w, stats };
}

export function runAdaptiveCycle() {
  const items = readLog();
  const stats = computeStats(items);
  return applyAdaptive(stats);
}

export function getAdaptiveSnapshot() {
  const items = readLog();
  const stats = computeStats(items);
  const weights = currentWeights();
  return {
    ts: ts(),
    stats,
    weights,
    meta: (typeof window !== 'undefined' && window.__LBQ_WEIGHTS_META__) || null,
  };
}

if (typeof window !== 'undefined') {
  setInterval(() => {
    try {
      const r = runAdaptiveCycle();
      if (r && r.changed) {
        // silent
      }
    } catch {
      // silent
    }
  }, ADAPT_INTERVAL_MS);
}