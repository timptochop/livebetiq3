// src/utils/predictor.js
// v3.3 - EV + Kelly + Volatility + dynamic thresholds (+ odds resolver fallback)

import applyVolatility from "../aiPredictionEngineModules/applyVolatility";
import { getLbqConfig } from "./lbqConfigClient";
import { resolveOddsForLiveMatch } from "./oddsParser";

const DEFAULT_THRESHOLDS = {
  SAFE_MIN_EV: 0.03,
  SAFE_MIN_CONF: 0.58,
  SAFE_MAX_VOL: 0.55,
  RISKY_MIN_EV: 0.01,
  RISKY_MIN_CONF: 0.53,
  MAX_VOL_RISKY: 0.9,
  MIN_ODDS: 1.3,
  MAX_ODDS: 7.5,
};

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

function normalizeThresholds(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_THRESHOLDS };

  const out = { ...DEFAULT_THRESHOLDS };

  const map = {
    SAFE_MIN_EV: "SAFE_MIN_EV",
    SAFE_MIN_CONF: "SAFE_MIN_CONF",
    MAX_VOL_SAFE: "SAFE_MAX_VOL",
    SAFE_MAX_VOL: "SAFE_MAX_VOL",
    RISKY_MIN_EV: "RISKY_MIN_EV",
    RISKY_MIN_CONF: "RISKY_MIN_CONF",
    MAX_VOL_RISKY: "MAX_VOL_RISKY",
    MIN_ODDS: "MIN_ODDS",
    MAX_ODDS: "MAX_ODDS",
  };

  Object.keys(map).forEach((k) => {
    const targetKey = map[k];
    let v = raw[k];
    if (v === undefined && raw[targetKey] !== undefined) {
      v = raw[targetKey];
    }
    const n = Number(v);
    if (Number.isFinite(n)) {
      out[targetKey] = n;
    }
  });

  return out;
}

function chooseLabel({ ev, confidence, volatility, thresholds }) {
  const v = clamp01(volatility);
  const c = clamp01(confidence);
  const e = Number(ev) || 0;

  const th = normalizeThresholds(thresholds);

  if (e >= th.SAFE_MIN_EV && c >= th.SAFE_MIN_CONF && v <= th.SAFE_MAX_VOL) {
    return "SAFE";
  }

  const maxVolRisky = Number(th.MAX_VOL_RISKY);
  const volOkForRisky =
    !Number.isFinite(maxVolRisky) || maxVolRisky <= 0 ? true : v <= maxVolRisky;

  if (e >= th.RISKY_MIN_EV && c >= th.RISKY_MIN_CONF && volOkForRisky) {
    return "RISKY";
  }

  return "AVOID";
}

function buildTip(ctx, side) {
  const p1 = String(ctx.player1 || ctx.p1 || "").trim();
  const p2 = String(ctx.player2 || ctx.p2 || "").trim();

  if (side === "p1" && p1) return `TIP: ${p1} to win match`;
  if (side === "p2" && p2) return `TIP: ${p2} to win match`;
  return "";
}

function chooseSide(ctx) {
  const ev1 = safeNumber(ctx.evP1, NaN);
  const ev2 = safeNumber(ctx.evP2, NaN);

  if (Number.isFinite(ev1) && Number.isFinite(ev2)) {
    if (ev1 > ev2) return "p1";
    if (ev2 > ev1) return "p2";
  }

  const o1 = safeNumber(ctx.oddsP1 || ctx.odds1 || ctx.decimalOdds1, NaN);
  const o2 = safeNumber(ctx.oddsP2 || ctx.odds2 || ctx.decimalOdds2, NaN);

  if (Number.isFinite(o1) && !Number.isFinite(o2)) return "p1";
  if (Number.isFinite(o2) && !Number.isFinite(o1)) return "p2";

  return "p1";
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * If ctx has no valid odds, try to resolve from oddsIndex/oddsList.
 * This is a SAFE fallback: it only runs when odds are missing/invalid.
 */
function maybeResolveOdds(ctx) {
  const out = {
    ctxPatched: ctx,
    resolve: { attempted: false, ok: false, via: "none", score: 0, meta: null },
  };

  const o1 = safeNumber(ctx.oddsP1 || ctx.odds1 || ctx.decimalOdds1, 0);
  const o2 = safeNumber(ctx.oddsP2 || ctx.odds2 || ctx.decimalOdds2, 0);

  const hasAnyValidOdds = (o1 && o1 > 1.01) || (o2 && o2 > 1.01);
  if (hasAnyValidOdds) return out;

  const oddsIndex = ctx.oddsIndex || ctx._oddsIndex || null;
  const oddsList = ctx.oddsList || ctx._oddsList || null;

  if (!oddsIndex && !oddsList) return out;

  out.resolve.attempted = true;

  const liveMatch = ctx.liveMatch || ctx.match || ctx;

  const r = resolveOddsForLiveMatch(
    liveMatch,
    oddsIndex,
    oddsList,
    ctx.oddsResolveOpts || ctx._oddsResolveOpts || {}
  );

  out.resolve.ok = !!r.ok;
  out.resolve.via = r.via || "none";
  out.resolve.score = r.score || 0;
  out.resolve.meta = r.meta || null;

  if (!r.ok || !r.odds) return out;

  const patched = { ...ctx };

  // Map resolved odds (home/away) to ctx player1/player2 when possible
  const p1 = normalizeName(patched.player1 || patched.p1);
  const p2 = normalizeName(patched.player2 || patched.p2);
  const home = normalizeName(r.odds.homeName);
  const away = normalizeName(r.odds.awayName);

  const homeOdds = safeNumber(r.odds.homeOdds, 0);
  const awayOdds = safeNumber(r.odds.awayOdds, 0);

  if (p1 && p2 && home && away) {
    const direct = p1 === home && p2 === away;
    const swapped = p1 === away && p2 === home;

    if (direct) {
      patched.oddsP1 = homeOdds;
      patched.oddsP2 = awayOdds;
    } else if (swapped) {
      patched.oddsP1 = awayOdds;
      patched.oddsP2 = homeOdds;
    } else {
      // fallback: keep as home->p1, away->p2
      patched.oddsP1 = homeOdds;
      patched.oddsP2 = awayOdds;
    }
  } else {
    // fallback
    patched.oddsP1 = homeOdds;
    patched.oddsP2 = awayOdds;
  }

  patched._oddsResolved = {
    ok: true,
    via: out.resolve.via,
    score: out.resolve.score,
    meta: out.resolve.meta,
    bookmaker: r.odds.bookmaker || "",
    ts: r.odds.ts || 0,
  };

  // Optional debug log (opt-in)
  if (patched.debugOddsResolve || patched._debugOddsResolve) {
    try {
      // eslint-disable-next-line no-console
      console.log("[ODDS RESOLVE]", {
        matchId: patched.matchId || patched.id || null,
        via: patched._oddsResolved.via,
        score: patched._oddsResolved.score,
        meta: patched._oddsResolved.meta,
        oddsP1: patched.oddsP1,
        oddsP2: patched.oddsP2,
      });
    } catch {
      // ignore
    }
  }

  out.ctxPatched = patched;
  return out;
}

export function runPredictor(ctx = {}) {
  // SAFE: only patches ctx when odds are missing/invalid
  const patchedPack = maybeResolveOdds(ctx);
  const c = patchedPack.ctxPatched;

  const side = chooseSide(c);

  const decimalOdds =
    side === "p1"
      ? safeNumber(c.oddsP1 || c.odds1 || c.decimalOdds1, 0)
      : safeNumber(c.oddsP2 || c.odds2 || c.decimalOdds2, 0);

  if (!decimalOdds || decimalOdds <= 1.01) {
    return {
      ok: false,
      label: "AVOID",
      reason: "no-valid-odds",
      matchId: c.matchId || c.id || null,
      oddsResolve: c._oddsResolved || (patchedPack.resolve.attempted ? patchedPack.resolve : null),
    };
  }

  let thresholdsRaw =
    c.thresholds || c.lbqConfig || c.config || c.lbqThresholds || null;

  if (!thresholdsRaw) {
    thresholdsRaw = getLbqConfig();
  }

  const thresholds = normalizeThresholds(thresholdsRaw);

  const minOdds = Number(thresholds.MIN_ODDS);
  const maxOdds = Number(thresholds.MAX_ODDS);

  if (Number.isFinite(minOdds) && decimalOdds < minOdds) {
    return {
      ok: false,
      label: "AVOID",
      reason: "odds-out-of-range",
      matchId: c.matchId || c.id || null,
      decimalOdds,
      oddsResolve: c._oddsResolved || null,
    };
  }

  if (Number.isFinite(maxOdds) && decimalOdds > maxOdds) {
    return {
      ok: false,
      label: "AVOID",
      reason: "odds-out-of-range",
      matchId: c.matchId || c.id || null,
      decimalOdds,
      oddsResolve: c._oddsResolved || null,
    };
  }

  const fairProbRaw =
    side === "p1"
      ? c.fairProbP1 ?? c.probP1 ?? c.fair1
      : c.fairProbP2 ?? c.probP2 ?? c.fair2;

  const fairProb =
    fairProbRaw != null ? clamp01(fairProbRaw) : computeFairProbFromOdds(decimalOdds);

  const ev = computeEV(fairProb, decimalOdds);
  const baseConfidence = computeBaseConfidence(fairProb, ev);
  const baseKelly = computeKelly(fairProb, decimalOdds);

  const basePrediction = {
    ok: true,
    matchId: c.matchId || c.id || null,
    side,
    player: side === "p1" ? c.player1 || c.p1 || null : c.player2 || c.p2 || null,
    decimalOdds,
    fairProb,
    ev,
    confidence: baseConfidence,
    kelly: baseKelly,
    modelVersion: "v3.3",
    volatility: 0,
    volatilityBreakdown: null,
    thresholds,
    oddsResolve: c._oddsResolved || null,
  };

  const volCtx = {
    setIndex: c.setIndex,
    games: c.games,
    pointScore: c.pointScore,
    recentGameSwing: c.recentGameSwing,
    breaksInSet: c.breaksInSet,
    bpFacedThisGame: c.bpFacedThisGame,
    tiebreak: c.tiebreak,
    lineDriftAbs: c.lineDriftAbs,
    surface: c.surface,
    p1HoldPct: c.p1HoldPct,
    p2HoldPct: c.p2HoldPct,
  };

  const withVolatility = applyVolatility(basePrediction, volCtx);

  const label = chooseLabel({
    ev: withVolatility.ev,
    confidence: withVolatility.confidence,
    volatility: withVolatility.volatility,
    thresholds,
  });

  const tip = buildTip(c, side);

  return {
    ...withVolatility,
    label,
    tip,
  };
}

export const predict = runPredictor;
export default runPredictor;