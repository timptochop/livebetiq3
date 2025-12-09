// src/utils/predictor.js
// v3.2 – EV + Kelly + Volatility integration

import applyVolatility from '../aiPredictionEngineModules/applyVolatility';

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function computeFairProbFromOdds(decimalOdds) {
  const o = safeNumber(decimalOdds, 0);
  if (o <= 1.01) return 0;
  return clamp01(1 / o);
}

function computeEV(prob, decimalOdds) {
  const p = clamp01(prob);
  const o = safeNumber(decimalOdds, 0);
  if (o <= 1.01) return 0;
  const gain = o - 1;
  return p * gain - (1 - p);
}

function computeKelly(prob, decimalOdds) {
  const p = clamp01(prob);
  const o = safeNumber(decimalOdds, 0);
  const b = o - 1;
  if (b <= 0) return 0;
  const q = 1 - p;
  const f = (b * p - q) / b;
  if (!Number.isFinite(f)) return 0;
  return Math.max(0, Math.min(0.25, f));
}

function computeBaseConfidence(prob, ev) {
  const p = clamp01(prob);
  const e = Number(ev);
  let base = 0.55 + Math.max(-0.1, Math.min(0.1, e * 4));
  if (p > 0.7 || p < 0.35) {
    base += 0.02;
  }
  return clamp01(base);
}

function chooseLabel({ ev, confidence, volatility }) {
  const v = clamp01(volatility);
  const c = clamp01(confidence);
  const e = Number(ev) || 0;

  if (e >= 0.03 && c >= 0.58 && v <= 0.55) {
    return 'SAFE';
  }

  if (e >= 0.01 && c >= 0.53) {
    return 'RISKY';
  }

  return 'AVOID';
}

function buildTip(ctx, side) {
  const p1 = String(ctx.player1 || ctx.p1 || '').trim();
  const p2 = String(ctx.player2 || ctx.p2 || '').trim();

  if (side === 'p1' && p1) return `TIP: ${p1} to win match`;
  if (side === 'p2' && p2) return `TIP: ${p2} to win match`;
  return '';
}

function chooseSide(ctx) {
  const ev1 = safeNumber(ctx.evP1, NaN);
  const ev2 = safeNumber(ctx.evP2, NaN);

  if (Number.isFinite(ev1) && Number.isFinite(ev2)) {
    if (ev1 > ev2) return 'p1';
    if (ev2 > ev1) return 'p2';
  }

  const o1 = safeNumber(ctx.oddsP1 || ctx.odds1 || ctx.decimalOdds1, NaN);
  const o2 = safeNumber(ctx.oddsP2 || ctx.odds2 || ctx.decimalOdds2, NaN);

  if (Number.isFinite(o1) && !Number.isFinite(o2)) return 'p1';
  if (Number.isFinite(o2) && !Number.isFinite(o1)) return 'p2';

  return 'p1';
}

export function runPredictor(ctx = {}) {
  const side = chooseSide(ctx);

  const decimalOdds =
    side === 'p1'
      ? safeNumber(ctx.oddsP1 || ctx.odds1 || ctx.decimalOdds1, 0)
      : safeNumber(ctx.oddsP2 || ctx.odds2 || ctx.decimalOdds2, 0);

  if (!decimalOdds || decimalOdds <= 1.01) {
    return {
      ok: false,
      label: 'AVOID',
      reason: 'no-valid-odds',
      matchId: ctx.matchId || ctx.id || null,
    };
  }

  const fairProbRaw =
    side === 'p1'
      ? ctx.fairProbP1 ?? ctx.probP1 ?? ctx.fair1
      : ctx.fairProbP2 ?? ctx.probP2 ?? ctx.fair2;

  const fairProb =
    fairProbRaw != null
      ? clamp01(fairProbRaw)
      : computeFairProbFromOdds(decimalOdds);

  const ev = computeEV(fairProb, decimalOdds);
  const baseConfidence = computeBaseConfidence(fairProb, ev);
  const baseKelly = computeKelly(fairProb, decimalOdds);

  const basePrediction = {
    ok: true,
    matchId: ctx.matchId || ctx.id || null,
    side,
    player:
      side === 'p1'
        ? ctx.player1 || ctx.p1 || null
        : ctx.player2 || ctx.p2 || null,
    decimalOdds,
    fairProb,
    ev,
    confidence: baseConfidence,
    kelly: baseKelly,
    modelVersion: 'v3.2',
    volatility: 0,
    volatilityBreakdown: null,
  };

  const volCtx = {
    setIndex: ctx.setIndex,
    games: ctx.games,
    pointScore: ctx.pointScore,
    recentGameSwing: ctx.recentGameSwing,
    breaksInSet: ctx.breaksInSet,
    bpFacedThisGame: ctx.bpFacedThisGame,
    tiebreak: ctx.tiebreak,
    lineDriftAbs: ctx.lineDriftAbs,
    surface: ctx.surface,
    p1HoldPct: ctx.p1HoldPct,
    p2HoldPct: ctx.p2HoldPct,
  };

  const withVolatility = applyVolatility(basePrediction, volCtx);

  const label = chooseLabel({
    ev: withVolatility.ev,
    confidence: withVolatility.confidence,
    volatility: withVolatility.volatility,
  });

  const tip = buildTip(ctx, side);

  return {
    ...withVolatility,
    label,
    tip,
  };
}

export const predict = runPredictor;
export default runPredictor;