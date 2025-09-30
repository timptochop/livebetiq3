// src/utils/predictionLogger.js
const KEY = '__lbq_predictions_log__';
const MAX = 1000;

export function logPrediction(entry) {
  try {
    const now = Date.now();
    const row = { ts: now, ...entry };
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    arr.unshift(row);
    if (arr.length > MAX) arr.length = MAX;
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {}
}

export function readPredictions(limit = 100) {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    return arr.slice(0, limit);
  } catch {
    return [];
  }
}