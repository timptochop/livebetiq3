// src/utils/oddsTracker.js

const BUF = new Map();

export function trackOdds(matchId, impliedProb, now = Date.now()) {
  if (!matchId || !Number.isFinite(impliedProb)) return;

  const arr = BUF.get(matchId) || [];
  arr.push({ t: now, p: impliedProb });

  const cutoff = now - 10 * 60 * 1000;
  while (arr.length && arr[0].t < cutoff) {
    arr.shift();
  }

  BUF.set(matchId, arr);
}

export function getDrift(matchId, windowMs = 5 * 60 * 1000) {
  const arr = BUF.get(matchId) || [];
  if (arr.length < 2) return 0;

  const now = Date.now();
  const pastIdx = arr.findIndex((x) => x.t >= now - windowMs);
  const base = (pastIdx >= 0 ? arr[pastIdx] : arr[0]).p;
  const last = arr[arr.length - 1].p;

  if (!Number.isFinite(base) || !Number.isFinite(last) || base === 0) {
    return 0;
  }

  return last - base;
}