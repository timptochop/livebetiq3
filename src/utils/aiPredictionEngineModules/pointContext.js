// src/utils/aiPredictionEngineModules/pointContext.js
// v1.0 — Break-point awareness, deuce pressure, micro-guards (Set2 window 3–6)
// Safe, dependency-free, UTF-8 (ASCII only)

export default function pointContext(match = {}) {
  const players = Array.isArray(match.players) ? match.players : [];
  const a = players[0] || {};
  const b = players[1] || {};

  const gA = toInt(a.games ?? a.g ?? a.currentGame ?? 0);
  const gB = toInt(b.games ?? b.g ?? b.currentGame ?? 0);
  const totalGames = gA + gB;

  const setNum = normalizedSetNum(match);
  const [pA, pB] = parsePointScore(
    match.pointScore ||
      a.pointScore ||
      b.pointScore ||
      `${coercePoint(a.point)}-${coercePoint(b.point)}`
  );

  const serverIndex = detectServerIndex(match, a, b); // 0 | 1 | null
  const isTieBreak = gA >= 6 && gB >= 6;

  const isDeuce = pA === 3 && pB === 3;
  const isAdvA = pA === 4 && pB === 3;
  const isAdvB = pB === 4 && pA === 3;

  // Game-point detection (one point from game)
  const isGamePointA = (pA === 4) || (pA === 3 && pB <= 2);
  const isGamePointB = (pB === 4) || (pB === 3 && pA <= 2);

  // Break-point (receiver has game point)
  const isBreakPointA =
    serverIndex === 1 && (isGamePointA || isAdvA); // B serves, A one point from game
  const isBreakPointB =
    serverIndex === 0 && (isGamePointB || isAdvB); // A serves, B one point from game

  // Pressure score 0..1
  let pressure = 0.4;
  if (isDeuce) pressure += 0.3;
  if (isAdvA || isAdvB) pressure += 0.2;
  if (isBreakPointA || isBreakPointB) pressure += 0.2;
  pressure = clamp01(pressure);

  // Micro-guards (policy-level signals, not labels)
  const inSet2Window = setNum === 2 && totalGames >= 3 && totalGames <= 6 && !isTieBreak;
  const suggestLabelOverride = !inSet2Window ? 'AVOID' : null;

  // Confidence nudges (symmetric; to be applied by predictor)
  const biasA = (isGamePointA ? 0.03 : 0) + (isBreakPointA ? 0.02 : 0) + (isAdvA ? 0.01 : 0);
  const biasB = (isGamePointB ? 0.03 : 0) + (isBreakPointB ? 0.02 : 0) + (isAdvB ? 0.01 : 0);
  const suggestConfDelta = round2(clamp(-0.05, 0.05, biasA - biasB)); // -0.05..+0.05

  const pointState =
    isDeuce ? 'DEUCE' :
    isAdvA  ? 'ADV_A' :
    isAdvB  ? 'ADV_B' :
    'NORMAL';

  const notes = [];
  if (isBreakPointA) notes.push('BreakPoint_A');
  if (isBreakPointB) notes.push('BreakPoint_B');
  if (isDeuce) notes.push('Deuce');
  if (isAdvA) notes.push('Advantage_A');
  if (isAdvB) notes.push('Advantage_B');
  if (isTieBreak) notes.push('TieBreak');
  if (!inSet2Window) notes.push('OutOfSet2Window');

  return {
    setNum,
    gA,
    gB,
    totalGames,
    pA,
    pB,
    serverIndex,
    isDeuce,
    isAdvA,
    isAdvB,
    isGamePointA,
    isGamePointB,
    isBreakPointA,
    isBreakPointB,
    isTieBreak,
    pressure,               // 0..1
    suggestConfDelta,       // -0.05..+0.05
    suggestLabelOverride,   // 'AVOID' | null
    pointState,             // NORMAL | DEUCE | ADV_A | ADV_B
    inSet2Window,           // boolean
    notes                   // string[]
  };
}

// --------- helpers ---------

function normalizedSetNum(m = {}) {
  const s = String(m.status || m.set || '').toLowerCase();
  if (s.includes('set 3')) return 3;
  if (s.includes('set 2')) return 2;
  if (s.includes('set 1')) return 1;
  if (Number.isFinite(m.setNum)) return m.setNum;
  return 0;
}

function parsePointScore(raw = '') {
  const map = { '0': 0, '15': 1, '30': 2, '40': 3, 'ad': 4, 'a': 4, 'adv': 4, 'advantage': 4 };
  const parts = String(raw || '').replace(/\s+/g, '').toLowerCase().split('-');
  if (parts.length !== 2) return [0, 0];
  return [map[parts[0]] ?? 0, map[parts[1]] ?? 0];
}

function coercePoint(v) {
  if (v == null) return '0';
  const s = String(v).trim();
  if (!s) return '0';
  if (/^(0|15|30|40|Ad|A|ADV|Advantage)$/i.test(s)) return s;
  // Some feeds provide numeric ladder 0..4
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return '0';
  return ['0', '15', '30', '40', 'Ad'][Math.max(0, Math.min(4, n))];
}

function detectServerIndex(match = {}, a = {}, b = {}) {
  // Try several common GoalServe shapes
  const direct =
    match.server ??
    match.serving ??
    match.serve ??
    match.currentServer ??
    a.serving != null ? (truthy(a.serving) ? 0 : truthy(b.serving) ? 1 : null) :
    null;

  if (direct === 0 || direct === 1) return direct;
  if (typeof direct === 'string') {
    const s = direct.toLowerCase();
    if (s === 'a' || s === '1' || s === 'player1' || s === 'home') return 0;
    if (s === 'b' || s === '2' || s === 'player2' || s === 'away') return 1;
  }
  if (direct === true) return 0; // some feeds: true=playerA
  if (direct === false) return 1; // false=playerB

  // fallback unknown
  return null;
}

function truthy(v) {
  if (v === true || v === 1) return true;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y';
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function clamp(min, max, x) {
  return Math.max(min, Math.min(max, x));
}

function clamp01(x) {
  return clamp(0, 1, x);
}

function round2(x) {
  return Math.round((Number(x) || 0) * 100) / 100;
}