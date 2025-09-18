// src/utils/predictionLogger.js
//
// Lightweight logger: αποθηκεύει μόνο τοπικά (localStorage) + console.
// Δεν αλλάζει το UI / την απόδοση του engine.

const KEY = 'lbq-logs-v1';
const SEEN = new Set();

function clampSize(arr, max = 500) {
  if (arr.length > max) return arr.slice(arr.length - max);
  return arr;
}

export function logPredictionOnce(match, ai) {
  try {
    if (!match?.id) return;
    if (!['SAFE','RISKY'].includes(ai?.label)) return;
    if (SEEN.has(match.id)) return;
    SEEN.add(match.id);

    const row = {
      ts: Date.now(),
      id: match.id,
      players: (match.players || match.player || []).map(p => p?.name || p?.['@name'] || ''),
      label: ai.label,
      pick: ai.pick || null,
      set: match.setNum || null,
      ev: ai.ev,
      conf: ai.confidence,
      kelly: ai.kelly,
      cat: match.categoryName || match.category || '',
      status: match.status || match['@status'] || '',
    };

    // console trace
    console.log('[LBQ][LOG]', row);

    // localStorage buffer
    let buf = [];
    try { buf = JSON.parse(localStorage.getItem(KEY)) || []; } catch {}
    buf.push(row);
    localStorage.setItem(KEY, JSON.stringify(clampSize(buf)));
  } catch (e) {
    // μην σπάσεις ποτέ το UI για logging
    console.warn('[LBQ][LOG][ERR]', e?.message);
  }
}