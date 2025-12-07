/**
 * src/utils/predictor.js
 * v3.4c — rawProb for EV/Kelly + normalized conf for labels
 * Sends favProb/favOdds both in features AND top-level (για τον logger).
 */

import { logPrediction } from './predictionLogger';

// -------------------------
// Helpers
// -------------------------
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
  return { gA, gB, total: gA + gB, diff: Math.abs(gA - gB) };
}

function parsePointScore(raw = '') {
  const mapping = { '0': 0, '15': 1, '30': 2, '40': 3, Ad: 4, AD: 4, ad: 4 };
  const parts = String(raw || '').split('-');
  if (parts.length !== 2) return [0, 0];
  const pA = mapping[parts[0].trim()] ?? 0;
  const pB = mapping[parts[1].trim()] ?? 0;
  return [pA, pB];
}

function previousSetWinner(players = []) {
  const a = players?.[0] || {};
  const b = players?.[1] || {};
  const s1 = parseInt(a.s1 ?? 0, 10) || 0;
  const s2 = parseInt(b.s1 ?? 0, 10) || 0;
  if (s1 === s2) return 0;
  return s1 > s2 ? 1 : 2;
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

// normalize model-score → [0,1] “confidence for labels”
function normalizeConf(c) {
  const min = 0.4;
  const max = 0.9;
  if (c <= min) return 0;
  if (c >= max) return 1;
  return (c - min) / (max - min);
}

function surfaceAdjust(surface = '', indoor = false) {
  const s = String(surface).toLowerCase();
  let adj = 0;
  if (s.includes('clay')) adj -= 0.05;
  if (s.includes('grass')) adj += 0.05;
  if (s.includes('hard')) adj += 0;
  if (indoor) adj += 0.03;
  return adj;
}

// -------------------------
// Volatility model (0..1)
// -------------------------
function volatilityScore(ctx = {}) {
  const { gA = 0, gB = 0, total = 0, diff = 0, pointScore = '' } = ctx;
  const [pA, pB] = parsePointScore(pointScore);

  let vol;
  if (total <= 3) vol = 0.65;
  else if (total <= 6) vol = diff >= 2 ? 0.75 : 0.55;
  else if (total <= 9) vol = diff >= 3 ? 0.6 : 0.45;
  else vol = 0.35;

  if (Math.abs(pA - pB) >= 2) vol += 0.05;
  if (pA === 4 || pB === 4) vol += 0.05;

  return Math.max(0, Math.min(1, Math.round(vol * 100) / 100));
}

// -------------------------
// Kelly Criterion
// -------------------------
function kellyFraction(prob, odds) {
  if (!Number.isFinite(odds) || odds <= 1) return 0;
  const p = prob;
  if (!Number.isFinite(p) || p <= 0 || p >= 1) return 0;
  const b = odds - 1;
  const q = 1 - p;
  const fStar = (b * p - q) / b;
  if (fStar <= 0) return 0;
  return round2(Math.min(fStar, 1));
}

// -------------------------
// Core predictor (SET 2 focus)
// -------------------------
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
    ...featuresIn,
  };

  if (!f.live) {
    const badge =
      f.setNum === 1 ? 'SET 1' :
      f.setNum === 2 ? 'SET 2' :
      f.setNum >= 3 ? 'SET 3' : 'START SOON';
    return decorate({ label: badge, conf: 0, tip: '', kellyFraction: 0 }, f, m);
  }

  if (f.setNum === 1) {
    return decorate({ label: 'SET 1', conf: 0, tip: '', kellyFraction: 0 }, f, m);
  }
  if (f.setNum >= 3) {
    return decorate({ label: 'SET 3', conf: 0, tip: '', kellyFraction: 0 }, f, m);
  }

  const { gA, gB, total, diff } = currentGameFromScores(m.players || []);
  if (total < 3) {
    return decorate({ label: 'SET 2', conf: 0, tip: '', kellyFraction: 0 }, f, m);
  }
  if (total > 6 || (gA >= 6 && gB >= 6)) {
    return decorate({ label: 'AVOID', conf: 0, tip: '', kellyFraction: 0 }, f, m);
  }

  const w = [1.6, 0.9, 1.1, 0.3];
  const b0 = -1.0;

  let rawProb = sigmoid(
    w[0] * clampOdds(f.pOdds) +
      w[1] * (Number.isFinite(f.momentum) ? f.momentum : 0) +
      w[2] * (Number.isFinite(f.drift) ? f.drift : 0) +
      w[3] +
      b0
  );

  const winner = previousSetWinner(m.players || []);
  if (winner === 1) rawProb += 0.05;
  else if (winner === 2) rawProb -= 0.05;

  if (f.drift > 0.1) rawProb -= 0.05;
  if (f.drift < -0.1) rawProb += 0.05;

  rawProb += surfaceAdjust(f.surface, f.indoor);

  const [pA, pB] = parsePointScore(f.pointScore);
  if (pA - pB >= 2) rawProb += 0.05;
  if (pB - pA >= 2) rawProb -= 0.05;

  const vol = volatilityScore({ gA, gB, total, diff, pointScore: f.pointScore });
  rawProb = rawProb * (1 - 0.25 * vol);

  rawProb = Math.min(0.99, Math.max(0.01, rawProb));
  const favProb = round2(rawProb);

  let confScore = normalizeConf(rawProb);
  confScore = Math.min(1, Math.max(0, confScore));
  const conf = round2(confScore);

  let label = 'RISKY';
  if (conf >= 0.8) label = 'SAFE';
  else if (conf < 0.65) label = 'AVOID';

  const favOdds =
    Number.isFinite(f.pOdds) && f.pOdds > 1 ? round2(f.pOdds) : 0;

  f.favProb = favProb;
  f.favOdds = favOdds;

  const rawKelly = kellyFraction(rawProb, f.pOdds);
  const kMult = 1 - 0.5 * vol;
  const kScaled = round2(Math.max(0, rawKelly * kMult));

  const tip = makeTip(m, f);

  const out = decorate(
    {
      label,
      conf,
      tip,
      kellyFraction: kScaled,
      // ΚΡΙΣΙΜΟ: top-level πεδία για τον logger
      favProb,
      favOdds,
    },
    f,
    m
  );

  try {
    const p1 = m?.players?.[0]?.name || '';
    const p2 = m?.players?.[1]?.name || '';

    logPrediction({
      matchId: m.id || m.matchId || '-',
      label,
      conf,
      tip,
      kelly: kScaled,
      favProb,
      favOdds,
      features: {
        ...out.features,
        favProb,
        favOdds,
      },
      p1,
      p2,
    });
  } catch (e) {}

  try {
    console.table([
      {
        matchId: m.id || '-',
        players: `${m?.players?.[0]?.name || '?'} vs ${
          m?.players?.[1]?.name || '?'
        }`,
        setNum: f.setNum,
        gA,
        gB,
        total,
        diff,
        pointScore: f.pointScore,
        odds: f.pOdds,
        momentum: f.momentum,
        drift: f.drift,
        surface: f.surface,
        vol,
        prob: favProb,
        conf,
        label,
        kelly: kScaled,
      },
    ]);
  } catch (e) {}

  return out;
}

// -------------------------
// Internal utilities
// -------------------------
function decorate(out, features, m) {
  out.features = {
    ...features,
    live: features.live ? 1 : 0,
    setNum: features.setNum ?? currentSetFromScores(m),
  };
  return out;
}

function clampOdds(v) {
  if (!Number.isFinite(v)) return 0.5;
  const min = 1.1;
  const max = 3.0;
  const t = Math.max(min, Math.min(max, v));
  const norm = (t - min) / (max - min);
  return 1 - norm;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function makeTip(m = {}, f = {}) {
  const pA =
    m?.players?.[0]?.name ||
    m?.home?.name ||
    firstFromName(m?.name, 0) ||
    'Player A';
  const pB =
    m?.players?.[1]?.name ||
    m?.away?.name ||
    firstFromName(m?.name, 1) ||
    'Player B';

  if (Number.isFinite(f.pOdds)) {
    return f.pOdds <= 1.75
      ? `TIP: ${pA} to win match`
      : `TIP: ${pB} to win match`;
  }

  if ((f.momentum ?? 0) >= 0) return `TIP: ${pA} to win match`;
  return `TIP: ${pB} to win match`;
}

function firstFromName(full, index) {
  if (!full || typeof full !== 'string') return null;
  const vs = full.split(' vs ');
  if (vs.length !== 2) return null;
  return vs[index]?.trim() || null;
}

export default function run(m = {}, features = {}) {
  return predictMatch(m, features);
}