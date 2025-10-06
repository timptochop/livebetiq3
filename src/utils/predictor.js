// src/utils/predictor.js
// v3.5-calibrated — Set2 window (games 3–6), pointContext nudges, volatility-scaled confidence (softer),
// dynamic Kelly with volatility buckets, TIP without prefix, console.table on exit.

import pointContext from './aiPredictionEngineModules/pointContext';

export function currentSetFromScores(m = {}) {
  const s = (m.status || m.set || '').toString().toLowerCase();
  if (s.includes('set 3')) return 3;
  if (s.includes('set 2')) return 2;
  if (s.includes('set 1')) return 1;
  if (Number.isFinite(m.setNum)) return m.setNum;
  return 0;
}

function currentGameFromScores(players = []) {
  const a = players?.[0] || {};
  const b = players?.[1] || {};
  const gA = parseInt(a.games ?? a.g ?? a.currentGame ?? 0, 10) || 0;
  const gB = parseInt(b.games ?? b.g ?? b.currentGame ?? 0, 10) || 0;
  return { gA, gB, total: gA + gB };
}

function parsePointScore(raw = '') {
  const map = { '0': 0, '15': 1, '30': 2, '40': 3, 'Ad': 4, 'A': 4, 'ADV': 4 };
  const parts = String(raw || '').split('-');
  if (parts.length !== 2) return [0, 0];
  return [map[parts[0]] ?? 0, map[parts[1]] ?? 0];
}

function previousSetWinner(players = []) {
  const a = players?.[0] || {};
  const b = players?.[1] || {};
  const s1 = parseInt(a.s1 ?? 0, 10) || 0;
  const s2 = parseInt(b.s1 ?? 0, 10) || 0;
  if (s1 === s2) return 0;
  return s1 > s2 ? 1 : 2;
}

function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }

function normalizeConf(c) {
  const min = 0.4, max = 0.9;
  if (c <= min) return 0;
  if (c >= max) return 1;
  return (c - min) / (max - min);
}

function surfaceAdjust(surface = '', indoor = false) {
  const s = String(surface || '').toLowerCase();
  let adj = 0;
  if (s.includes('clay')) adj -= 0.05;
  if (s.includes('grass')) adj += 0.05;
  if (s.includes('hard')) adj += 0;
  if (indoor) adj += 0.03;
  return adj;
}

// Kelly Criterion (fraction of bankroll) — internal
function kellyFraction(conf, odds) {
  if (!Number.isFinite(odds) || odds <= 1) return 0;
  const b = odds - 1, p = conf, q = 1 - p;
  const fStar = (b * p - q) / b;
  return fStar > 0 ? round2(Math.min(fStar, 1)) : 0;
}

export function predictMatch(m = {}, featuresIn = {}) {
  const f = {
    pOdds: featuresIn.pOdds ?? m.pOdds ?? null,
    momentum: featuresIn.momentum ?? m.momentum ?? 0,
    drift: featuresIn.drift ?? m.drift ?? 0,
    live: featuresIn.live ?? m.live ?? false,
    setNum: featuresIn.setNum ?? currentSetFromScores(m),
    surface: m.categoryName || m.surface || '',
    indoor: /indoor/i.test(m.categoryName || m.surface || ''),
    pointScore: m.pointScore || '',
    ...featuresIn
  };

  // Not live => START SOON / SET badges
  if (!f.live) {
    const badge = f.setNum === 1 ? 'SET 1' : f.setNum === 2 ? 'SET 2' : f.setNum >= 3 ? 'SET 3' : 'START SOON';
    return withDebug(m, f, { label: badge, conf: 0.0, tip: '', kellyFraction: 0, stakePct: 0, volatility: null });
  }

  // Set gate
  if (f.setNum === 1) {
    return withDebug(m, f, { label: 'SET 1', conf: 0.0, tip: '', kellyFraction: 0, stakePct: 0, volatility: null });
  }
  if (f.setNum >= 3) {
    return withDebug(m, f, { label: 'SET 3', conf: 0.0, tip: '', kellyFraction: 0, stakePct: 0, volatility: null });
  }

  // Set 2 window guards (games 3–6) & tiebreak
  const { gA, gB, total } = currentGameFromScores(m.players || []);
  const tieBreak = (gA >= 6 && gB >= 6);
  if (tieBreak) {
    return withDebug(m, f, { label: 'AVOID', conf: 0.0, tip: '', kellyFraction: 0, stakePct: 0, volatility: null }, { gA, gB });
  }
  if (total < 3) {
    return withDebug(m, f, { label: 'SET 2', conf: 0.0, tip: '', kellyFraction: 0, stakePct: 0, volatility: null }, { gA, gB });
  }
  if (total > 6) {
    return withDebug(m, f, { label: 'AVOID', conf: 0.0, tip: '', kellyFraction: 0, stakePct: 0, volatility: null }, { gA, gB });
  }

  // --- pointContext wiring (break-point/deuce awareness & micro-guards) ---
  const ctx = safePointContext(m);
  if (ctx.suggestLabelOverride === 'AVOID') {
    return withDebug(m, f, { label: 'AVOID', conf: 0.0, tip: '', kellyFraction: 0, stakePct: 0, volatility: null },
      { gA, gB, vol: null, ctx });
  }

  // Base linear model
  const w = [1.6, 0.9, 1.1, 0.3];
  const b = -1.0;
  const x0 = clampOdds(f.pOdds);
  const x1 = Number.isFinite(f.momentum) ? f.momentum : 0;
  const x2 = Number.isFinite(f.drift) ? f.drift : 0;
  let conf = sigmoid(w[0]*x0 + w[1]*x1 + w[2]*x2 + w[3] + b);

  // Context adjustments
  const winner = previousSetWinner(m.players || []);
  if (winner === 1) conf += 0.05; else if (winner === 2) conf -= 0.05;

  if (f.drift >  0.10) conf -= 0.05;
  if (f.drift < -0.10) conf += 0.05;

  conf += surfaceAdjust(f.surface, f.indoor);

  const [pA, pB] = parsePointScore(f.pointScore);
  if (pA - pB >= 2) conf += 0.05;
  if (pB - pA >= 2) conf -= 0.05;

  // pointContext nudges (bounded -0.05..+0.05)
  conf += clamp(-0.05, 0.05, ctx.suggestConfDelta || 0);

  // Normalize 0..1
  conf = normalizeConf(conf);
  conf = Math.min(1, Math.max(0, conf));

  // Volatility proxy (internal) — SOFTER penalty
  const vol = volatilityScoreLocal(m);           // ~0.3..0.8 typical
  const volOver = Math.max(0, vol - 0.5);       // penalize only high volatility
  const confScale = 1 - volOver * 0.30;         // up to -30% scaling on conf (softer vs v3.4)
  conf = round2(Math.min(1, Math.max(0, conf * confScale)));

  // Calibrated thresholds (tighter)
  const SAFE_TH  = 0.83;
  const AVOID_TH = 0.63;

  let label = 'RISKY';
  if (conf >= SAFE_TH) label = 'SAFE';
  else if (conf < AVOID_TH) label = 'AVOID';

  // Tip WITHOUT "TIP: " (UI προθέτει "TIP: ")
  const tipText = makeTip(m, f);

  // Dynamic Kelly:
  //   - volatility dampening (softer)
  //   - pressure dampening (unchanged)
  //   - bucketed bankroll caps per volatility
  const baseK = kellyFraction(conf, f.pOdds);
  const kVolScale = 1 - volOver * 0.60;                 // was 0.80 → ηπιότερο
  const pressureOver = Math.max(0, (ctx.pressure ?? 0) - 0.6);
  const kPressureScale = 1 - pressureOver * 0.40;
  const kScaled = Math.max(0, baseK * kVolScale * kPressureScale);

  // bucket caps (volatility-aware)
  const cap =
    vol >= 0.75 ? 0.010 :   // 1.0% σε πολύ υψηλή ένταση
    vol >= 0.60 ? 0.015 :   // 1.5% σε μεσαία-υψηλή
    vol >= 0.50 ? 0.020 :   // 2.0% σε ουδέτερη
                           0.025;    // 2.5% σε χαμηλή ένταση
  const stakePct = round2(Math.min(kScaled, cap));

  return withDebug(
    m, f,
    {
      label,
      conf: round2(conf),
      tip: tipText,
      kellyFraction: round2(baseK),
      stakePct,
      volatility: round2(vol),
      pointState: ctx.pointState
    },
    { gA, gB, vol, ctx }
  );
}

// ---- utilities ----

function decorate(out, features, m) {
  out.features = {
    ...features,
    live: features.live ? 1 : 0,
    setNum: features.setNum ?? currentSetFromScores(m),
  };
  return out;
}

function withDebug(m, f, out, extras = {}) {
  try {
    const { gA, gB, vol, ctx } = extras;
    console.table([{
      aiVersion: 'v3.5-calibrated',
      matchId: m.id || '-',
      players: playersLabel(m),
      setNum: f.setNum ?? currentSetFromScores(m),
      games: (gA != null && gB != null) ? `${gA}-${gB}` : '',
      pointScore: f.pointScore || '',
      odds: f.pOdds,
      momentum: f.momentum,
      drift: f.drift,
      surface: f.surface,
      indoor: !!f.indoor,
      conf: out.conf,
      label: out.label,
      volatility: out.volatility ?? vol ?? null,
      kellyFraction: out.kellyFraction ?? 0,
      stakePct: out.stakePct ?? 0,
      pointState: out.pointState ?? (ctx ? ctx.pointState : ''),
      pressure: ctx ? ctx.pressure : null,
      override: ctx ? ctx.suggestLabelOverride : null,
      notes: ctx && Array.isArray(ctx.notes) ? ctx.notes.join('|') : ''
    }]);
  } catch {}
  return decorate(out, f, m);
}

function clampOdds(v) {
  if (!Number.isFinite(v)) return 0.5;
  const min = 1.1, max = 3.0;
  const t = Math.max(min, Math.min(max, v));
  const norm = (t - min) / (max - min);
  return 1 - norm; // lower odds -> higher signal
}

function round2(x) { return Math.round(x * 100) / 100; }

function makeTip(m = {}, f = {}) {
  const pA = m?.players?.[0]?.name || m?.home?.name || firstFromName(m?.name, 0) || 'Player A';
  const pB = m?.players?.[1]?.name || m?.away?.name || firstFromName(m?.name, 1) || 'Player B';
  if (Number.isFinite(f.pOdds)) return f.pOdds <= 1.75 ? `${pA} to win match` : `${pB} to win match`;
  if ((f.momentum ?? 0) >= 0) return `${pA} to win match`;
  return `${pB} to win match`;
}

function firstFromName(full, index) {
  if (!full || typeof full !== 'string') return null;
  const vs = full.split(' vs ');
  if (vs.length !== 2) return null;
  return vs[index]?.trim() || null;
}

function playersLabel(m) {
  const a = m?.players?.[0]?.name || m?.home?.name || firstFromName(m?.name, 0) || 'Player A';
  const b = m?.players?.[1]?.name || m?.away?.name || firstFromName(m?.name, 1) || 'Player B';
  return `${a} vs ${b}`;
}

// Local volatility proxy to avoid external import drift
function volatilityScoreLocal(match = {}) {
  const players = Array.isArray(match.players) ? match.players : [];
  const a = players[0] || {};
  const b = players[1] || {};
  const gA = parseInt(a.games ?? a.g ?? a.currentGame ?? 0, 10) || 0;
  const gB = parseInt(b.games ?? b.g ?? b.currentGame ?? 0, 10) || 0;
  const total = gA + gB;

  let v = 0.5; // neutral
  if (total >= 4 && total <= 10) {
    const diff = Math.abs(gA - gB);
    if (diff <= 1) v = 0.8;       // tight, high tension
    else if (diff === 2) v = 0.6; // moderate
    else v = 0.4;                 // one-sided
  } else if (total > 10) {
    v = 0.3; // stabilized later
  }
  return Math.round(v * 100) / 100;
}

function clamp(min, max, x) { return Math.max(min, Math.min(max, x)); }

function safePointContext(m) {
  try { return pointContext(m) || {}; } catch { return {}; }
}

export default function run(m = {}, features = {}) {
  return predictMatch(m, features);
}